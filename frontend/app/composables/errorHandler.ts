import { FetchError } from "ofetch";

export const useErrorHandler = () => {
  const handleError = (err: unknown): string => {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      return "Request timed out. Please try again.";
    }

    if (err instanceof FetchError) {
      if (!err.statusCode) {
        return "Could not reach the server. Please check your connection.";
      }
      switch (err.statusCode) {
        case 400:
          return "Bad request.";
        case 401:
          return "Unauthorized. Please login again.";
        case 403:
          return "You do not have permission to do this.";
        case 404:
          return "Resource not found.";
        case 500:
          return "Server error. Please try again later.";
        default:
          return err.message || "Something went wrong.";
      }
    }

    return "An unexpected error occurred.";
  };

  return { handleError };
};
