// Imported first by smokeTest.ts so that these are set before ../lib/bot loads
// (ES imports are hoisted above any statements in the importing module).
process.env.API_TOKEN ??= "123456:SMOKE_TEST_TOKEN";
process.env.NODE_ENV = "test";
