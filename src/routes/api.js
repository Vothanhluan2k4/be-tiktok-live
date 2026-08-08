import express from 'express';
import { getConfig, updateConfig, generateNewToken, proxyTTS } from '../controllers/configController.js';
import { startLiveConnection, stopLiveConnection, getConnectionStatus, triggerTestEvent } from '../controllers/connectionController.js';

const router = express.Router();

// Overlay Config & TTS Proxy endpoints
router.get('/config', getConfig);
router.get('/config/:token', getConfig);
router.put('/config', updateConfig);
router.put('/config/:token', updateConfig);
router.post('/config/generate-token', generateNewToken);
router.get('/tts', proxyTTS);

// TikTok Connection controls
router.post('/connection/start', startLiveConnection);
router.post('/connection/stop', stopLiveConnection);
router.get('/connection/status', getConnectionStatus);
router.get('/connection/status/:token', getConnectionStatus);
router.post('/connection/test-event', triggerTestEvent);

export default router;
