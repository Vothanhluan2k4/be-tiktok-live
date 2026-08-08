import http from 'http';
import { TTSService } from '../src/services/TTSService.js';

console.log('====================================================');
console.log('🚀 RUNNING UAT SUITE - TIKTOK LIVE TTS READER');
console.log('====================================================\n');

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(` ✅ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(` ❌ FAIL: ${testName}`);
    failedTests++;
  }
}

async function request(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', (err) => reject(err));

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runUAT() {
  try {
    // 1. TTSService Unit Checks
    console.log('--- 1. TTS & Template Engine Tests ---');
    const speechText = TTSService.formatEventText('comment', { nickname: 'Minh', comment: 'Shop ơi tư vấn' });
    assert(speechText === 'Minh nói: Shop ơi tư vấn', 'TTSService comment template formatting');

    const memberText = TTSService.formatEventText('member', { nickname: 'Linh' });
    assert(memberText === 'Chào mừng Linh đã vào phòng live', 'TTSService member enter template formatting');

    const ttsUrl = TTSService.generateAudioUrl(speechText);
    assert(ttsUrl && ttsUrl.includes('/api/tts'), 'TTSService proxy audio URL generation');

    const proxyRes = await request(`/api/tts?text=${encodeURIComponent('Xin chào')}&lang=vi`);
    assert(proxyRes.status === 200, 'GET /api/tts returns audio stream 200 OK');

    const isBlocked = TTSService.isBlocked('đụ mẹ mày', ['đụ', 'dm']);
    assert(isBlocked === true, 'TTSService sensitive word blocking filter');

    // 2. API Integration Tests
    console.log('\n--- 2. REST API & Connection Tests ---');
    const token = 'demo-overlay-token';

    const configRes = await request(`/api/config/${token}`);
    assert(configRes.status === 200 && configRes.body.success, 'GET /api/config/:token returns 200 OK');

    const statusRes = await request(`/api/connection/status/${token}`);
    assert(statusRes.status === 200 && statusRes.body.success, 'GET /api/connection/status/:token returns 200 OK');

    const testCommentRes = await request('/api/connection/test-event', 'POST', {
      overlayToken: token,
      eventType: 'comment',
      customData: { comment: 'UAT Test Comment' }
    });
    assert(testCommentRes.status === 200 && testCommentRes.body.success, 'POST /api/connection/test-event [comment] trigger');

    const testMemberRes = await request('/api/connection/test-event', 'POST', {
      overlayToken: token,
      eventType: 'member',
      customData: { nickname: 'Người Xem UAT' }
    });
    assert(testMemberRes.status === 200 && testMemberRes.body.success, 'POST /api/connection/test-event [member] trigger');

    const testGiftRes = await request('/api/connection/test-event', 'POST', {
      overlayToken: token,
      eventType: 'gift',
      customData: { giftName: 'Hoa Hồng', repeatCount: 5 }
    });
    assert(testGiftRes.status === 200 && testGiftRes.body.success, 'POST /api/connection/test-event [gift] trigger');

    // Summary
    console.log('\n====================================================');
    console.log(`📊 UAT RESULT: ${passedTests} PASSED, ${failedTests} FAILED`);
    console.log('====================================================\n');

    if (failedTests > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }

  } catch (err) {
    console.error('❌ UAT Suite Error:', err.message);
    process.exit(1);
  }
}

runUAT();
