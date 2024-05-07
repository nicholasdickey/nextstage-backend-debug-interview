import express from "express";
import { createPrismaClient } from "./create-prisma-client";
import { exportWorkspaceOpportunitiesToCSV, generateHints, filterOpportunities,Filter } from "./services/opportunities";

const PORT = 4040;

const prisma = createPrismaClient();

const app = express();

app.use(express.json());

app.get("/opportunities/export", async (req, res) => {
  const csv = await exportWorkspaceOpportunitiesToCSV(prisma);

  res.setHeader("Content-Type", "text/csv");
  res.send(csv);
  res.end();
});

app.post("/opportunities/filtered-search", async (req, res) => {

  //this is for illustration purposes, not tested
  //filters are either descrete values for dropdowns and multi-dropdowns
  //or type-ahead search for short-text and name fields

  const { filters} = req.body as {filters:Filter[]};

  const response=await filterOpportunities(prisma,filters);
  res.setHeader("Content-Type", "text/json");
  res.send(response);
  res.end();
});
app.get("/opportunities/hints", async (req, res) => {
  // Implement me!


  const response=await generateHints(prisma);
  res.setHeader("Content-Type", "text/json");
  res.send(response);
  res.end();
});


app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
