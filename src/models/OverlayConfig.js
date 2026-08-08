import mongoose from 'mongoose';

const overlayConfigSchema = new mongoose.Schema({
  userId: { type: String, default: 'default_streamer' },
  tiktokUsername: { type: String, default: '' },
  overlayToken: { type: String, required: true, unique: true },
  ttsProvider: { type: String, default: 'google' }, // 'google' | 'webspeech'
  language: { type: String, default: 'vi' },
  speed: { type: String, default: 'normal' }, // 'normal' | 'slow'
  volume: { type: Number, default: 1 },
  giftMinValue: { type: Number, default: 0 },
  eventsEnabled: {
    comment: { type: Boolean, default: true },
    gift: { type: Boolean, default: true },
    follow: { type: Boolean, default: true },
    like: { type: Boolean, default: false },
    share: { type: Boolean, default: true }
  },
  templates: {
    comment: { type: String, default: '{nickname} nói: {text}' },
    gift: { type: String, default: 'Cảm ơn {nickname} đã tặng {count} {giftName}' },
    follow: { type: String, default: 'Cảm ơn {nickname} đã theo dõi kênh' },
    like: { type: String, default: '{nickname} đã thả tim' },
    share: { type: String, default: 'Cảm ơn {nickname} đã chia sẻ buổi live' }
  },
  blockedWords: [{ type: String }],
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

export const OverlayConfigModel = mongoose.models.OverlayConfig || mongoose.model('OverlayConfig', overlayConfigSchema);

// In-Memory store fallback when MongoDB is not connected
export const inMemoryConfigs = new Map();

export const getDefaultConfig = (token = 'default-overlay-token') => {
  return {
    userId: 'default_streamer',
    tiktokUsername: '',
    overlayToken: token,
    ttsProvider: 'google',
    language: 'vi',
    speed: 'normal',
    volume: 1,
    giftMinValue: 0,
    eventsEnabled: {
      comment: true,
      gift: true,
      follow: true,
      like: false,
      share: true
    },
    templates: {
      comment: '{nickname} nói: {text}',
      gift: 'Cảm ơn {nickname} đã tặng {count} {giftName}',
      follow: 'Cảm ơn {nickname} đã theo dõi kênh',
      like: '{nickname} đã thả tim',
      share: 'Cảm ơn {nickname} đã chia sẻ buổi live'
    },
    blockedWords: ['đụ', 'đám', 'dm', 'cl', 'vcl', 'dcm', 'chửi', 'lừa đảo'],
    isActive: true
  };
};
