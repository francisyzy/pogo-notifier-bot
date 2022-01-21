import * as dotenv from "dotenv";

dotenv.config();

const config = {
  PORT: process.env.PORT || "3000",
  DATABASE_URL: process.env.DATABASE_URL,
  API_TOKEN: process.env.API_TOKEN,
  LOG_GROUP_ID: process.env.LOG_GROUP_ID,
  URL: process.env.URL,
  eventBuffer: 20,
  raidAlertMinutes: 5,
  //https://gis.stackexchange.com/a/8674
  gymRange: 0.003,
  perfectRange: 0.001,
  perfectAdHocRange: 0.003,
};

export default config;
