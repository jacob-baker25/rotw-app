export function publicPost(post) {
  return post.is_anonymous
    ? { ...post, author_name: "Anonymous" }
    : post;
}

export function publicVote(vote) {
  return vote.is_anonymous
    ? { ...vote, voter_name: "Anonymous" }
    : vote;
}

export function ownVote(vote) {
  if (!vote) return null;
  return vote.is_anonymous ? { is_anonymous: true } : vote;
}
