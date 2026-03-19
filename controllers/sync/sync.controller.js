
const SaleController = require("../sales/sales.controller");
const LoanController = require("../loans/loans.controller");
const InventoryController = require("../inventory/inventory.controller");
const RESPONSE_CODES = require("../../constants/RESPONSE_CODES");
const RESPONSE_STATUS = require("../../constants/RESPONSE_STATUS");

const batchSync = async (req, res) => {
  const { requests } = req.body;
  
  if (!Array.isArray(requests)) {
    return res.status(RESPONSE_CODES.BAD_REQUEST).json({
      statusCode: RESPONSE_CODES.BAD_REQUEST,
      message: "Requests must be an array"
    });
  }

  const results = [];

  for (const syncReq of requests) {
    const { endpoint, method, body, id } = syncReq;
    
    // Create a mock req/res to call other controllers
    let result;
    const mockReq = { 
      headers: req.headers,
      user: req.user,
      conditions: req.conditions || {},
      body: typeof body === 'string' ? JSON.parse(body) : body,
      params: syncReq.params || {},
      query: syncReq.query || {},
      ip: req.ip,
      connection: req.connection
    };
    
    const mockRes = {
      status: (code) => {
        result = { statusCode: code };
        return {
          json: (data) => {
            result.data = data;
          }
        };
      }
    };

    try {
      if (endpoint === '/sales' && method === 'POST') {
        await SaleController.addSale(mockReq, mockRes);
      } else if (endpoint === '/loans' && method === 'POST') {
        await LoanController.createLoan(mockReq, mockRes);
      } else if (endpoint === '/inventory/adjust' && method === 'POST') {
        await InventoryController.adjustStock(mockReq, mockRes);
      } else if (endpoint.startsWith('/loans/') && endpoint.endsWith('/status') && method === 'PATCH') {
        mockReq.params.id = endpoint.split('/')[2];
        await LoanController.updateLoanStatus(mockReq, mockRes);
      } else {
        result = { statusCode: 404, data: { message: `Endpoint ${endpoint} not supported for sync` } };
      }
      
      results.push({ id, ...result });
    } catch (error) {
      results.push({ 
        id, 
        statusCode: 500, 
        data: { message: error.message || "Internal error during sync" } 
      });
    }
  }

  res.status(RESPONSE_CODES.OK).json({
    statusCode: RESPONSE_CODES.OK,
    httpStatus: RESPONSE_STATUS.OK,
    results
  });
};

module.exports = {
  batchSync
};
