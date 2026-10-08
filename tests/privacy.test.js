import test from "node:test";
import assert from "node:assert/strict";
import { ownVote, publicPost, publicVote } from "../lib/privacy.js";

test("anonymous ballot and its written post do not expose the voter through public state", () => {
  const vote = {
    id: "vote-id",
    voter_name: "Jacob",
    candidate_id: "candidate-id",
    reason_post_id: "post-id",
    is_anonymous: true,
  };
  const post = {
    id: "post-id",
    author_name: "Jacob",
    body: "A reason",
    is_anonymous: true,
  };

  assert.equal(publicVote(vote).voter_name, "Anonymous");
  assert.equal(publicPost(post).author_name, "Anonymous");
  assert.deepEqual(ownVote(vote), { is_anonymous: true });
});

test("named ballots and ordinary posts keep their authors", () => {
  const vote = { voter_name: "Will", is_anonymous: false };
  const post = { author_name: "Tommy", is_anonymous: false };
  assert.equal(publicVote(vote).voter_name, "Will");
  assert.equal(publicPost(post).author_name, "Tommy");
  assert.equal(ownVote(vote), vote);
});
