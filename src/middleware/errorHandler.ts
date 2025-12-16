import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let statusCode = 500;
  let message = 'Internal server error';
  let errors: any = undefined;

  // AppError (custom errors)
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
  }
  // Prisma errors
  else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    statusCode = 400;
    
    if (err.code === 'P2002') {
      message = 'A record with this value already exists';
      errors = { field: err.meta?.target };
    } else if (err.code === 'P2025') {
      message = 'Record not found';
      statusCode = 404;
    } else if (err.code === 'P2003') {
      message = 'Invalid reference to related record';
    }
  }
  // Prisma validation errors
  else if (err instanceof Prisma.PrismaClientValidationError) {
    statusCode = 400;
    message = 'Invalid data provided';
  }
  // JWT errors
  else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }
  // Validation errors (express-validator)
  else if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation failed';
  }

  // Always log errors
  console.error('[errorHandler] ERROR 💥:', err.message);
  console.error('[errorHandler] Stack:', err.stack);

  // Send response
  res.status(statusCode).json({
    success: false,
    message,
    errors,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

