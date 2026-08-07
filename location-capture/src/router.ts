import { Router, Request, Response, NextFunction } from 'express';
import { LocationCaptureService } from './service';

export function createLocationCaptureRouter(service: LocationCaptureService): Router {
  const router = Router();

  /**
   * POST /location/:linkId
   * Accepts { latitude: number, longitude: number }
   * On success: validates link, stores GPS pin persistently, marks link used, returns confirmation.
   * On failure: returns clear error (404 Not Found, 410 Gone, or 400 Bad Request).
   */
  router.post('/:linkId', (req: Request, res: Response, next: NextFunction): void => {
    const { linkId } = req.params;
    const { latitude, longitude } = req.body;

    if (latitude === undefined || longitude === undefined) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Both latitude and longitude must be provided in the request body.',
      });
      return;
    }

    try {
      const result = service.submitPin(linkId, Number(latitude), Number(longitude));
      res.status(200).json({
        message: 'Location pin submitted successfully.',
        customerId: result.customerId,
        orderId: result.orderId,
      });
    } catch (error: any) {
      // Handle the defensive errors thrown from service layer
      const statusCode = error.statusCode || 400;
      res.status(statusCode).json({
        error: statusCode === 404 ? 'Not Found' : statusCode === 410 ? 'Gone' : 'Bad Request',
        message: error.message || 'An error occurred during location pin submission.',
      });
    }
  });

  return router;
}
