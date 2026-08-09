import * as googleTTS from 'google-tts-api';
import { OverlayConfigModel, inMemoryConfigs, getDefaultConfig } from '../models/OverlayConfig.js';
import { tikTokManager } from '../services/TikTokConnectionManager.js';
import { v4 as uuidv4 } from 'uuid';

export const getConfig = async (req, res) => {
  try {
    const token = req.params.token || 'demo-overlay-token';
    
    let config = null;
    try {
      config = await OverlayConfigModel.findOne({ overlayToken: token }).lean();
    } catch (e) {
      // MongoDB offline fallback
    }

    if (!config) {
      config = inMemoryConfigs.get(token) || getDefaultConfig(token);
      inMemoryConfigs.set(token, config);
    }

    return res.json({ success: true, config });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const updateConfig = async (req, res) => {
  try {
    const token = req.params.token || 'demo-overlay-token';
    const newConfigData = req.body;

    let updatedConfig = null;

    try {
      updatedConfig = await OverlayConfigModel.findOneAndUpdate(
        { overlayToken: token },
        { $set: newConfigData },
        { new: true, upsert: true }
      ).lean();
    } catch (e) {
      // MongoDB offline fallback
    }

    if (!updatedConfig) {
      const current = inMemoryConfigs.get(token) || getDefaultConfig(token);
      updatedConfig = { ...current, ...newConfigData, overlayToken: token };
      inMemoryConfigs.set(token, updatedConfig);
    }

    // Update runtime configuration inside active connection
    tikTokManager.updateConfig(token, updatedConfig);

    // Broadcast config update to Overlay via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(token).emit('config_updated', {
        config: updatedConfig,
        timestamp: new Date().toISOString()
      });

      if (req.body?.shouldReloadOverlay) {
        io.to(token).emit('reload_overlay', { timestamp: new Date().toISOString() });
      }
    }

    return res.json({ success: true, config: updatedConfig, message: 'Đã lưu cấu hình và đồng bộ Overlay thành công!' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const reloadOverlayClient = async (req, res) => {
  try {
    const token = req.params.token || req.body?.overlayToken || 'demo-overlay-token';
    const io = req.app.get('io');
    if (io) {
      io.to(token).emit('reload_overlay', { timestamp: new Date().toISOString() });
    }
    return res.json({ success: true, message: 'Đã gửi lệnh tải lại Overlay!' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const generateNewToken = async (req, res) => {
  try {
    const newToken = `streamer_${uuidv4().substring(0, 12)}`;
    const newConfig = getDefaultConfig(newToken);
    inMemoryConfigs.set(newToken, newConfig);

    try {
      await OverlayConfigModel.create(newConfig);
    } catch (e) {}

    return res.json({ success: true, overlayToken: newToken, config: newConfig });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const proxyTTS = async (req, res) => {
  const { text, lang = 'vi', slow = 'false' } = req.query;
  if (!text) return res.status(400).send('Missing text parameter');

  try {
    const googleUrl = googleTTS.getAudioUrl(text.substring(0, 200), {
      lang: lang,
      slow: slow === 'true',
      host: 'https://translate.google.com',
      timeout: 10000,
    });

    const response = await fetch(googleUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`Google TTS returned status ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(buffer);
  } catch (err) {
    console.error('[TTS Proxy Error]:', err.message);
    return res.status(500).send(err.message);
  }
};
