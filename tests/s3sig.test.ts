import { test } from "node:test";
import assert from "node:assert/strict";
import { EMPTY_SHA256, amzDate, awsEncode, signRequest } from "../src/lib/s3sig";

// Vector from the AWS S3 documentation ("Signature Calculations … Example: GET Object").
const creds = { accessKeyId: "AKIAIOSFODNN7EXAMPLE", secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY", region: "us-east-1" };
const date = new Date("2013-05-24T00:00:00Z");

test("GET object with Range matches the AWS documentation signature", () => {
  const h = signRequest({
    method: "GET",
    url: new URL("https://examplebucket.s3.amazonaws.com/test.txt"),
    headers: { range: "bytes=0-9" },
    payloadHash: EMPTY_SHA256,
    date,
    ...creds,
  });
  assert.equal(h["x-amz-date"], "20130524T000000Z");
  assert.equal(
    h.authorization,
    "AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41",
  );
});

test("GET bucket lifecycle (query string) matches the AWS documentation signature", () => {
  const h = signRequest({
    method: "GET",
    url: new URL("https://examplebucket.s3.amazonaws.com/?lifecycle"),
    headers: {},
    payloadHash: EMPTY_SHA256,
    date,
    ...creds,
  });
  assert.match(h.authorization, /Signature=fea454ca298b7da1c68078a5d1bdbfbbe0d65c699e0f91ac7a200a0136783543$/);
});

test("helpers", () => {
  assert.equal(amzDate(date), "20130524T000000Z");
  assert.equal(awsEncode("a b*(c)"), "a%20b%2A%28c%29");
  assert.equal(awsEncode("~-_."), "~-_.");
});
