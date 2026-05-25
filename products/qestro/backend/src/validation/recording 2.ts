import Joi from 'joi';

export const recordingValidationSchemas = {
  startRecording: {
    body: Joi.object({
      type: Joi.string().valid('mobile', 'web').required(),
      platform: Joi.string().required(),
      projectId: Joi.string().uuid().optional(),
      name: Joi.string().max(255).optional(),
      metadata: Joi.object({
        deviceName: Joi.string().max(100).optional(),
        appId: Joi.string().max(255).optional(),
        url: Joi.string().uri().optional(),
        viewport: Joi.object({
          width: Joi.number().integer().min(1).max(10000).optional(),
          height: Joi.number().integer().min(1).max(10000).optional(),
        }).optional(),
        userAgent: Joi.string().max(500).optional(),
      }).optional(),
      outputDir: Joi.string().max(500).optional(),
      recordVideo: Joi.boolean().optional(),
      recordScreenshots: Joi.boolean().optional(),
    }),
  },

  stopRecording: {
    body: Joi.object({
      sessionId: Joi.string().uuid().required(),
    }),
  },

  exportRecording: {
    params: Joi.object({
      sessionId: Joi.string().uuid().required(),
    }),
    query: Joi.object({
      format: Joi.string().valid('maestro', 'workflow-use', 'json').optional(),
    }),
  },

  listRecordingSessions: {
    query: Joi.object({
      page: Joi.number().integer().min(1).optional(),
      limit: Joi.number().integer().min(1).max(100).optional(),
      status: Joi.string().valid('idle', 'recording', 'processing', 'completed', 'error').optional(),
      type: Joi.string().valid('mobile', 'web').optional(),
      projectId: Joi.string().uuid().optional(),
    }),
  },

  deleteRecordingSession: {
    params: Joi.object({
      sessionId: Joi.string().uuid().required(),
    }),
  },
};

export default recordingValidationSchemas;

export const validateRecordingRequest = (req: any, res: any, next: any) => {
  // Simple validation for now - can be enhanced later
  if (!req.body || !req.body.type) {
    return res.status(400).json({ error: 'Recording type is required' });
  }
  next();
};