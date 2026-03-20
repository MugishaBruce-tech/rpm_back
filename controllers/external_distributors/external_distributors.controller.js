const ExternalDistributor = require("../../models/ExternalDistributor");

exports.getAll = async (req, res) => {
  try {
    const distributors = await ExternalDistributor.findAll();
    res.status(200).json({ statusCode: 200, result: distributors });
  } catch (error) {
    console.error("Error fetching external distributors:", error);
    res.status(500).json({ statusCode: 500, message: "Internal Server Error" });
  }
};

exports.create = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: "Name is required" });
    const newDistributor = await ExternalDistributor.create({ name });
    res.status(201).json({ statusCode: 201, result: newDistributor });
  } catch (error) {
    console.error("Error creating external distributor:", error);
    res.status(500).json({ statusCode: 500, message: "Internal Server Error" });
  }
};
