const RESPONSE_CODES = require("../constants/RESPONSE_CODES");
const RESPONSE_STATUS = require("../constants/RESPONSE_STATUS");

/**
 * Higher-order middleware to validate req.body against a Zod schema.
 */
const validate = (schema) => (req, res, next) => {
  try {
    schema.parse(req.body);
    next();
  } catch (error) {
    const issues = error.issues ?? error.errors ?? [];
    const formattedErrors = issues.map(err => ({
      path: err.path.join('.'),
      message: err.message
    }));

    return res.status(RESPONSE_CODES.UNPROCESSABLE_ENTITY).json({
      statusCode: RESPONSE_CODES.UNPROCESSABLE_ENTITY,
      httpStatus: RESPONSE_STATUS.UNPROCESSABLE_ENTITY,
      message: "Input validation error",
      errors: formattedErrors
    });
  }
};

module.exports = validate;
