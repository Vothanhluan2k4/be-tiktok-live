import * as googleTTS from 'google-tts-api';

export class TTSService {
  /**
   * Synthesize text to a playable Google TTS Audio URL
   * @param {string} text 
   * @param {object} options { lang, speed }
   * @returns {string} audioUrl
   */
  static generateAudioUrl(text, options = {}) {
    const lang = options.lang || 'vi';
    const slow = (options.speed === 'slow' || options.speed < 0.9) ? 'true' : 'false';
    try {
      if (!text || text.trim().length === 0) return null;
      const cleanText = text.trim().substring(0, 200);
      const port = process.env.PORT || 5000;
      const baseUrl = process.env.SERVER_URL || `http://localhost:${port}`;
      return `${baseUrl}/api/tts?text=${encodeURIComponent(cleanText)}&lang=${lang}&slow=${slow}`;
    } catch (err) {
      console.error('[TTSService] Failed to generate TTS URL:', err.message);
      return null;
    }
  }

  /**
   * Format live event data into Vietnamese natural speech text
   */
  static formatEventText(eventType, data, config = {}) {
    const nickname = data.nickname || data.uniqueId || 'Người xem';
    
    switch (eventType) {
      case 'comment': {
        const commentTemplate = config.templates?.comment || '{nickname} nói: {text}';
        return commentTemplate
          .replace('{nickname}', nickname)
          .replace('{text}', data.comment || '');
      }
      
      case 'gift': {
        const count = data.repeatCount || 1;
        const giftName = data.giftName || 'quà';
        const giftTemplate = config.templates?.gift || 'Cảm ơn {nickname} đã tặng {count} {giftName}';
        return giftTemplate
          .replace('{nickname}', nickname)
          .replace('{count}', count)
          .replace('{giftName}', giftName);
      }
      
      case 'follow': {
        const followTemplate = config.templates?.follow || 'Cảm ơn {nickname} đã theo dõi kênh';
        return followTemplate.replace('{nickname}', nickname);
      }
      
      case 'like': {
        const likeTemplate = config.templates?.like || '{nickname} đã thả tim';
        return likeTemplate.replace('{nickname}', nickname);
      }
      
      case 'share': {
        const shareTemplate = config.templates?.share || 'Cảm ơn {nickname} đã chia sẻ live';
        return shareTemplate.replace('{nickname}', nickname);
      }
      
      case 'member': {
        const memberTemplate = config.templates?.member || 'Chào mừng {nickname} đã vào phòng live';
        return memberTemplate.replace('{nickname}', nickname);
      }
      
      default:
        return data.text || '';
    }
  }

  /**
   * Filter text against blocked words blacklist
   */
  static isBlocked(text, blockedWords = []) {
    if (!text || !blockedWords || blockedWords.length === 0) return false;
    const lowerText = text.toLowerCase();
    return blockedWords.some(word => {
      const w = word.trim().toLowerCase();
      return w && lowerText.includes(w);
    });
  }
}
