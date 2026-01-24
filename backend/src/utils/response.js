export const successResponse = (message, data = null) => {
  return {
    success: true,
    message,
    data
  };
};

export const errorResponse = (message, errors = null) => {
  const response = {
    success: false,
    message
  };
  
  if (errors) {
    response.errors = errors;
  }
  
  return response;
};

export default { successResponse, errorResponse };
