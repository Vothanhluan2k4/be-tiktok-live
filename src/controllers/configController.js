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

    return res.json({ success: true, config: updatedConfig, message: 'Đã lưu cấu hình thành công!' });
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
