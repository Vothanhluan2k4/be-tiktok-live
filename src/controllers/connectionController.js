import { tikTokManager } from '../services/TikTokConnectionManager.js';
import { inMemoryConfigs, OverlayConfigModel, getDefaultConfig } from '../models/OverlayConfig.js';

export const startLiveConnection = async (req, res) => {
  const io = req.app.get('io');
  const { overlayToken, tiktokUsername } = req.body;

  if (!tiktokUsername) {
    return res.status(400).json({ success: false, message: 'Vui lòng nhập TikTok Username (ví dụ: @streamer_shop)' });
  }

  const token = overlayToken || 'demo-overlay-token';

  // Get current config
  let config = inMemoryConfigs.get(token);
  if (!config) {
    try {
      config = await OverlayConfigModel.findOne({ overlayToken: token }).lean();
    } catch (e) {}
  }
  if (!config) {
    config = getDefaultConfig(token);
    inMemoryConfigs.set(token, config);
  }

  // Update TikTok username in config
  config.tiktokUsername = tiktokUsername;
  inMemoryConfigs.set(token, config);

  try {
    const result = await tikTokManager.startConnection(token, tiktokUsername, config, io);
    return res.json({ success: true, message: `Đã kết nối thành công phòng Live của @${tiktokUsername}`, result });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Kết nối tới phòng TikTok Live thất bại' });
  }
};

export const stopLiveConnection = async (req, res) => {
  const io = req.app.get('io');
  const { overlayToken } = req.body;
  const token = overlayToken || 'demo-overlay-token';

  try {
    await tikTokManager.stopConnection(token, io);
    return res.json({ success: true, message: 'Đã dừng kết nối phòng TikTok Live' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

export const getConnectionStatus = (req, res) => {
  const token = req.params.token || 'demo-overlay-token';
  const statusInfo = tikTokManager.getStatus(token);
  return res.json({ success: true, ...statusInfo });
};

export const triggerTestEvent = async (req, res) => {
  const io = req.app.get('io');
  const { overlayToken, eventType, data } = req.body;
  const token = overlayToken || 'demo-overlay-token';

  let config = inMemoryConfigs.get(token) || getDefaultConfig(token);

  try {
    tikTokManager.emitTestEvent(token, eventType || 'comment', data || {}, config, io);
    return res.json({ success: true, message: `Đã gửi sự kiện thử nghiệm [${eventType}] thành công!` });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};
