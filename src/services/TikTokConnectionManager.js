import { createRequire } from 'module';
import { TTSService } from './TTSService.js';

const require = createRequire(import.meta.url);
const { TikTokLiveConnection } = require('tiktok-live-connector');

class TikTokConnectionManager {
  constructor() {
    // Stores active TikTok connections: token -> { connection, username, config, stats, status, roomToken }
    this.connections = new Map();
  }

  /**
   * Start a TikTok Live room connection for a streamer
   */
  async startConnection(overlayToken, tiktokUsername, config, io) {
    // If connection already exists, clean it up first
    if (this.connections.has(overlayToken)) {
      await this.stopConnection(overlayToken, io);
    }

    const cleanUsername = tiktokUsername.replace(/^@/, '').trim();
    if (!cleanUsername) {
      throw new Error('Username TikTok không hợp lệ');
    }

    const sessionState = {
      username: cleanUsername,
      overlayToken,
      config: config || {},
      status: 'connecting',
      stats: { comments: 0, gifts: 0, follows: 0, likes: 0, connectedAt: new Date() },
      connection: null
    };

    this.connections.set(overlayToken, sessionState);
    this._broadcastStatus(overlayToken, 'connecting', 'Đang kết nối tới TikTok Live...', io);

    try {
      const tiktokLiveConnection = new TikTokLiveConnection(cleanUsername, {
        processInitialData: false,
        enableExtendedGiftInfo: false, // Set to false to avoid EulerStream paid signing requirement
        clientParams: {
          app_language: 'vi-VN',
          webcast_language: 'vi-VN'
        }
      });

      sessionState.connection = tiktokLiveConnection;

      // Register TikTok Live Event Handlers
      tiktokLiveConnection.on('chat', (data) => {
        this._handleCommentEvent(overlayToken, data, io);
      });

      tiktokLiveConnection.on('gift', (data) => {
        this._handleGiftEvent(overlayToken, data, io);
      });

      tiktokLiveConnection.on('follow', (data) => {
        this._handleFollowEvent(overlayToken, data, io);
      });

      tiktokLiveConnection.on('like', (data) => {
        this._handleLikeEvent(overlayToken, data, io);
      });

      tiktokLiveConnection.on('share', (data) => {
        this._handleShareEvent(overlayToken, data, io);
      });

      tiktokLiveConnection.on('streamEnd', () => {
        console.log(`[TikTokManager] Stream ended for @${cleanUsername}`);
        sessionState.status = 'offline';
        this._broadcastStatus(overlayToken, 'offline', 'Buổi Live đã kết thúc', io);
      });

      tiktokLiveConnection.on('disconnected', () => {
        console.log(`[TikTokManager] Disconnected from @${cleanUsername}`);
        if (sessionState.status !== 'stopped') {
          sessionState.status = 'disconnected';
          this._broadcastStatus(overlayToken, 'disconnected', 'Đã ngắt kết nối', io);
        }
      });

      tiktokLiveConnection.on('error', (err) => {
        console.error(`[TikTokManager] Error @${cleanUsername}:`, err?.message || err);
        sessionState.status = 'error';
        this._broadcastStatus(overlayToken, 'error', `Lỗi kết nối: ${err?.message || 'Không thể kết nối phòng Live'}`, io);
      });

      // Connect to Live room
      const state = await tiktokLiveConnection.connect();
      sessionState.status = 'connected';
      console.log(`[TikTokManager] Successfully connected to TikTok Live @${cleanUsername} (Room ID: ${state?.roomId || 'Active'})`);
      
      this._broadcastStatus(overlayToken, 'connected', `Đã kết nối phòng Live của @${cleanUsername}`, io, { roomId: state?.roomId });
      return { success: true, roomId: state?.roomId, username: cleanUsername };

    } catch (err) {
      console.error(`[TikTokManager] Connection failed @${cleanUsername}:`, err?.message || err);
      sessionState.status = 'error';
      this.connections.delete(overlayToken);
      this._broadcastStatus(overlayToken, 'error', err?.message || 'Không thể kết nối. Vui lòng kiểm tra lại TikTok username (phòng cần phải ĐANG LIVE).', io);
      throw new Error(err?.message || 'Kết nối tới TikTok Live thất bại.');
    }
  }

  /**
   * Stop connection for a streamer
   */
  async stopConnection(overlayToken, io) {
    const sessionState = this.connections.get(overlayToken);
    if (sessionState) {
      sessionState.status = 'stopped';
      if (sessionState.connection) {
        try {
          sessionState.connection.disconnect();
        } catch (e) {
          // ignore disconnect errors
        }
      }
      this.connections.delete(overlayToken);
      this._broadcastStatus(overlayToken, 'disconnected', 'Đã tắt kết nối TTS Live', io);
    }
    return { success: true };
  }

  /**
   * Get connection info & stats for dashboard
   */
  getStatus(overlayToken) {
    const sessionState = this.connections.get(overlayToken);
    if (!sessionState) {
      return { status: 'disconnected', stats: { comments: 0, gifts: 0, follows: 0, likes: 0 } };
    }
    return {
      status: sessionState.status,
      username: sessionState.username,
      stats: sessionState.stats
    };
  }

  /**
   * Update active connection config on the fly
   */
  updateConfig(overlayToken, newConfig) {
    const sessionState = this.connections.get(overlayToken);
    if (sessionState) {
      sessionState.config = { ...sessionState.config, ...newConfig };
    }
  }

  /**
   * Simulate event for testing sound & visuals directly from Dashboard
   */
  emitTestEvent(overlayToken, eventType, testData, config, io) {
    const sessionState = this.connections.get(overlayToken);
    const activeConfig = sessionState?.config || config || {};

    let mockData = {};
    if (eventType === 'comment') {
      mockData = {
        uniqueId: testData.nickname || 'khach_hang_demo',
        nickname: testData.nickname || 'Khách Hàng Thân Thiết',
        comment: testData.comment || 'Shop ơi cho mình hỏi áo này bao nhiêu kg mặc vừa ạ?',
        profilePictureUrl: testData.avatar || 'https://p16-sign-va.tiktokcdn.com/tos-maliva-avt-0068/default-avatar.jpeg'
      };
      this._handleCommentEvent(overlayToken, mockData, io, activeConfig, true);
    } else if (eventType === 'gift') {
      mockData = {
        uniqueId: testData.nickname || 'dai_gia_tiktok',
        nickname: testData.nickname || 'Đại Gia Phố Núi',
        giftName: testData.giftName || 'Hoa Hồng',
        repeatCount: testData.repeatCount || 10,
        diamondCount: testData.diamondCount || 5,
        giftPictureUrl: testData.giftUrl || 'https://p16-webcast.tiktokcdn.com/img/webcast/gift_rose.png'
      };
      this._handleGiftEvent(overlayToken, mockData, io, activeConfig, true);
    } else if (eventType === 'follow') {
      mockData = {
        uniqueId: testData.nickname || 'fan_cung',
        nickname: testData.nickname || 'Fan Cứng Chăm Chỉ'
      };
      this._handleFollowEvent(overlayToken, mockData, io, activeConfig, true);
    } else if (eventType === 'like') {
      mockData = {
        uniqueId: testData.nickname || 'kieu_anh',
        nickname: testData.nickname || 'Nguyễn Kiều Anh'
      };
      this._handleLikeEvent(overlayToken, mockData, io, activeConfig, true);
    }
  }

  _normalizeEventData(rawData) {
    if (!rawData) return {};
    const user = rawData.user || {};
    
    const nickname = rawData.nickname || user.nickname || rawData.uniqueId || user.uniqueId || 'Người xem';
    const uniqueId = rawData.uniqueId || user.uniqueId || nickname;
    const comment = rawData.comment || rawData.content || '';
    const avatar = rawData.profilePictureUrl || user.profilePictureUrl || user.avatarThumb?.urlList?.[0] || '';
    
    const giftName = rawData.giftName || rawData.giftDetails?.giftName || rawData.gift?.giftName || rawData.describe || 'Quà';
    const repeatCount = rawData.repeatCount || rawData.comboCount || 1;
    const diamondCount = rawData.diamondCount || rawData.giftDetails?.diamondCount || 1;
    const giftPictureUrl = rawData.giftPictureUrl || rawData.giftDetails?.giftImage?.urlList?.[0] || '';

    return {
      ...rawData,
      nickname,
      uniqueId,
      comment,
      text: comment,
      profilePictureUrl: avatar,
      giftName,
      repeatCount,
      diamondCount,
      giftPictureUrl
    };
  }

  // --- Internal Event Handlers ---

  _handleCommentEvent(overlayToken, rawData, io, overrideConfig = null, isTest = false) {
    const data = this._normalizeEventData(rawData);
    const sessionState = this.connections.get(overlayToken);
    const config = overrideConfig || sessionState?.config || {};
    const eventsEnabled = config.eventsEnabled || { comment: true };

    if (!eventsEnabled.comment && !isTest) return;

    // Word filter check
    if (TTSService.isBlocked(data.comment, config.blockedWords)) {
      console.log(`[TikTokManager] Blocked sensitive comment: "${data.comment}"`);
      return;
    }

    if (sessionState) sessionState.stats.comments++;

    const textToRead = TTSService.formatEventText('comment', data, config);
    const audioUrl = TTSService.generateAudioUrl(textToRead, { lang: config.language || 'vi', speed: config.speed || 'normal' });

    this._emitToOverlay(overlayToken, io, {
      id: `comment_${Date.now()}_${Math.random()}`,
      type: 'comment',
      user: data.nickname,
      avatar: data.profilePictureUrl,
      text: data.comment,
      speechText: textToRead,
      audioUrl: audioUrl,
      volume: config.volume ?? 1,
      createdAt: new Date().toISOString()
    });
  }

  _handleGiftEvent(overlayToken, rawData, io, overrideConfig = null, isTest = false) {
    const data = this._normalizeEventData(rawData);
    const sessionState = this.connections.get(overlayToken);
    const config = overrideConfig || sessionState?.config || {};
    const eventsEnabled = config.eventsEnabled || { gift: true };

    if (!eventsEnabled.gift && !isTest) return;

    // Filter gift value (repeatCount * diamondCount)
    const giftTotalCoins = (data.diamondCount || 1) * (data.repeatCount || 1);
    const minCoins = config.giftMinValue || 0;

    if (giftTotalCoins < minCoins && !isTest) {
      return;
    }

    if (sessionState) sessionState.stats.gifts++;

    const textToRead = TTSService.formatEventText('gift', data, config);
    const audioUrl = TTSService.generateAudioUrl(textToRead, { lang: config.language || 'vi', speed: config.speed || 'normal' });

    this._emitToOverlay(overlayToken, io, {
      id: `gift_${Date.now()}_${Math.random()}`,
      type: 'gift',
      user: data.nickname,
      giftName: data.giftName,
      repeatCount: data.repeatCount,
      giftPictureUrl: data.giftPictureUrl,
      text: `${data.giftName} x${data.repeatCount}`,
      speechText: textToRead,
      audioUrl: audioUrl,
      volume: config.volume ?? 1,
      createdAt: new Date().toISOString()
    });
  }

  _handleFollowEvent(overlayToken, rawData, io, overrideConfig = null, isTest = false) {
    const data = this._normalizeEventData(rawData);
    const sessionState = this.connections.get(overlayToken);
    const config = overrideConfig || sessionState?.config || {};
    if (!config.eventsEnabled?.follow && !isTest) return;

    if (sessionState) sessionState.stats.follows++;

    const textToRead = TTSService.formatEventText('follow', data, config);
    const audioUrl = TTSService.generateAudioUrl(textToRead, { lang: config.language || 'vi' });

    this._emitToOverlay(overlayToken, io, {
      id: `follow_${Date.now()}_${Math.random()}`,
      type: 'follow',
      user: data.nickname,
      speechText: textToRead,
      audioUrl: audioUrl,
      volume: config.volume ?? 1,
      createdAt: new Date().toISOString()
    });
  }

  _handleLikeEvent(overlayToken, rawData, io, overrideConfig = null, isTest = false) {
    const data = this._normalizeEventData(rawData);
    const sessionState = this.connections.get(overlayToken);
    const config = overrideConfig || sessionState?.config || {};
    if (!config.eventsEnabled?.like && !isTest) return;

    if (sessionState) sessionState.stats.likes++;

    const textToRead = TTSService.formatEventText('like', data, config);
    const audioUrl = TTSService.generateAudioUrl(textToRead, { lang: config.language || 'vi' });

    this._emitToOverlay(overlayToken, io, {
      id: `like_${Date.now()}_${Math.random()}`,
      type: 'like',
      user: data.nickname,
      speechText: textToRead,
      audioUrl: audioUrl,
      volume: config.volume ?? 1,
      createdAt: new Date().toISOString()
    });
  }

  _handleShareEvent(overlayToken, rawData, io, overrideConfig = null, isTest = false) {
    const data = this._normalizeEventData(rawData);
    const sessionState = this.connections.get(overlayToken);
    const config = overrideConfig || sessionState?.config || {};
    if (!config.eventsEnabled?.share && !isTest) return;

    const textToRead = TTSService.formatEventText('share', data, config);
    const audioUrl = TTSService.generateAudioUrl(textToRead, { lang: config.language || 'vi' });

    this._emitToOverlay(overlayToken, io, {
      id: `share_${Date.now()}_${Math.random()}`,
      type: 'share',
      user: data.nickname,
      speechText: textToRead,
      audioUrl: audioUrl,
      volume: config.volume ?? 1,
      createdAt: new Date().toISOString()
    });
  }

  _emitToOverlay(overlayToken, io, payload) {
    if (io) {
      io.to(overlayToken).emit('live_event', payload);
    }
  }

  _broadcastStatus(overlayToken, status, message, io, extra = {}) {
    if (io) {
      io.to(overlayToken).emit('connection_status', {
        status,
        message,
        timestamp: new Date().toISOString(),
        ...extra
      });
    }
  }
}

export const tikTokManager = new TikTokConnectionManager();
