// * Optional way to handle microservices responses
export interface RpcSuccessResponse<T = void> {
  success: true;

  /**
   * Optional payload.
   * - undefined → no body (e.g. logout, reset password)
   * - object → returned data (e.g. signup result)
   */
  data?: T;

  /**
   * Optional semantic hints for the API Gateway
   */
  meta?: {
    /**
     * Recommended HTTP status code (gateway decides final value)
     * e.g. 201 for signup, 204 for logout
     */
    httpStatus?: number;

    /**
     * Optional human-readable message
     */
    message?: string;

    /**
     * Command execution timestamp
     */
    timestamp?: number;
  };
}
