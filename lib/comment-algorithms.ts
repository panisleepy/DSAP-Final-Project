export type CommentAlgo = "baseline" | "optimized";

export type CommentAuthor = {
  id: string;
  name: string | null;
  image: string | null;
  alias: string;
};

export type CommentNode = {
  id: string;
  content: string;
  createdAt: Date;
  parentCommentId: string | null;
  postId: string;
  rootPostId: string;
  author: CommentAuthor;
};

export type FlatComment = {
  id: string;
  content: string;
  createdAt: string;
  parentCommentId: string | null;
  postId: string;
  rootPostId: string;
  author: CommentAuthor;
  depth: number;
};

export function mapCommentNode(comment: CommentNode): Omit<FlatComment, "depth"> {
  return {
    id: comment.id,
    content: comment.content,
    createdAt: comment.createdAt.toISOString(),
    parentCommentId: comment.parentCommentId,
    postId: comment.postId,
    rootPostId: comment.rootPostId,
    author: comment.author,
  };
}

/** Baseline: flat sort by createdAt only (no tree / no depth semantics). */
export function sortCommentsBaseline(comments: CommentNode[]): FlatComment[] {
  return [...comments]
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((comment) => ({
      ...mapCommentNode(comment),
      depth: 0,
    }));
}

/** Optimized: adjacency list (Map) + DFS preorder with per-level time sort. */
export function flattenCommentsOptimized(comments: CommentNode[]): FlatComment[] {
  const childrenByParent = new Map<string, CommentNode[]>();
  const roots: CommentNode[] = [];

  comments.forEach((comment) => {
    if (!comment.parentCommentId) {
      roots.push(comment);
      return;
    }
    const siblings = childrenByParent.get(comment.parentCommentId) ?? [];
    siblings.push(comment);
    childrenByParent.set(comment.parentCommentId, siblings);
  });

  const byAscTime = (a: CommentNode, b: CommentNode) => a.createdAt.getTime() - b.createdAt.getTime();
  roots.sort(byAscTime);
  childrenByParent.forEach((nodes) => nodes.sort(byAscTime));

  const flattened: FlatComment[] = [];
  const stack = roots
    .slice()
    .reverse()
    .map((root) => ({ node: root, depth: 0 }));

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;

    flattened.push({
      ...mapCommentNode(current.node),
      depth: current.depth,
    });

    const children = childrenByParent.get(current.node.id) ?? [];
    for (let index = children.length - 1; index >= 0; index -= 1) {
      stack.push({ node: children[index], depth: current.depth + 1 });
    }
  }

  return flattened;
}

export type DepthDistributionEntry = {
  depth: number;
  count: number;
};

export type DepthDistributionSummary = {
  maxDepth: number;
  distribution: DepthDistributionEntry[];
};

/** Count how many flattened comments sit at each depth (0 = roots under the post). */
export function buildDepthDistribution(flat: FlatComment[]): DepthDistributionSummary {
  const counts = new Map<number, number>();
  flat.forEach((comment) => {
    counts.set(comment.depth, (counts.get(comment.depth) ?? 0) + 1);
  });

  const distribution = Array.from(counts.entries())
    .sort(([a], [b]) => a - b)
    .map(([depth, count]) => ({ depth, count }));

  const maxDepth = distribution.length > 0 ? distribution[distribution.length - 1]!.depth : 0;
  return { maxDepth, distribution };
}

export function runCommentAlgorithm(
  comments: CommentNode[],
  algo: CommentAlgo,
): FlatComment[] {
  return algo === "baseline" ? sortCommentsBaseline(comments) : flattenCommentsOptimized(comments);
}

export function parseCommentAlgo(value: string | null): CommentAlgo | null {
  if (value === "baseline" || value === "optimized") {
    return value;
  }
  return null;
}
