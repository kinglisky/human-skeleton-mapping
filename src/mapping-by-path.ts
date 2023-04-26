import { traverseNode, uniformName } from './utils';

import type { SkeletonNode } from './types';

/**
 * 莱文斯坦距离（Levenshtein Distance）:
 * @param s1
 * @param s2
 * @returns
 */
const levenshteinDistance = (s1: string, s2: string): number => {
    const matrix = Array.from({ length: s1.length + 1 }, () =>
        new Array(s2.length + 1).fill(0)
    );

    for (let i = 0; i <= s1.length; i++) matrix[i][0] = i;
    for (let j = 0; j <= s2.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= s1.length; i++) {
        for (let j = 1; j <= s2.length; j++) {
            const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j - 1] + cost
            );
        }
    }

    // 编辑距离
    const distance = matrix[s1.length][s2.length];
    // 换成与最长字符的比值
    return distance / Math.max(s1.length, s2.length);
};

/**
 * Jaccard 相似度（Jaccard Similarity）
 * @param s1
 * @param s2
 * @returns
 */
const jaccardSimilarity = (s1: string, s2: string): number => {
    const set1 = new Set(s1);
    const set2 = new Set(s2);

    const intersection = new Set([...set1].filter((x) => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
};

/**
 * 余弦相似度（Cosine Similarity）
 * @param s1
 * @param s2
 * @returns
 */
const cosineSimilarity = (s1: string, s2: string): number => {
    const termFrequency = (s: string) => {
        const tf: { [key: string]: number } = {};
        for (const c of s) tf[c] = (tf[c] || 0) + 1;
        return tf;
    };

    const dotProduct = (
        v1: { [key: string]: number },
        v2: { [key: string]: number }
    ): number => {
        let sum = 0;
        for (const key in v1) sum += (v1[key] || 0) * (v2[key] || 0);
        return sum;
    };

    const magnitude = (v: { [key: string]: number }): number => {
        let sum = 0;
        for (const key in v) sum += v[key] * v[key];
        return Math.sqrt(sum);
    };

    const tf1 = termFrequency(s1);
    const tf2 = termFrequency(s2);

    return dotProduct(tf1, tf2) / (magnitude(tf1) * magnitude(tf2));
};

/**
 * 字符串的最长公共子序列（LCS）
 * @param s1
 * @param s2
 * @returns
 */
export const longestCommonSubsequence = (s1: string, s2: string) => {
    const m = s1.length;
    const n = s2.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () =>
        Array.from({ length: n + 1 }, () => 0)
    );

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            if (s1.charAt(i - 1) == s2.charAt(j - 1)) {
                dp[i][j] = 1 + dp[i - 1][j - 1];
            } else {
                dp[i][j] = Math.max(dp[i][j - 1], dp[i - 1][j]);
            }
        }
    }

    const maxLength = dp[m][n];
    // 换成与最长字符的比值
    return maxLength / Math.max(s1.length, s2.length);
};

/**
 * Sørensen-Dice 系数（Sørensen-Dice Coefficient）
 * @param s1
 * @param s2
 * @returns
 */
const sorensenDiceCoefficient = (s1: string, s2: string): number => {
    const bigrams1 = new Set();
    const bigrams2 = new Set();
    let intersectionCount = 0;

    for (let i = 0; i < s1.length - 1; i++) {
        bigrams1.add(s1.slice(i, i + 2));
    }

    for (let i = 0; i < s2.length - 1; i++) {
        const bigram = s2.slice(i, i + 2);
        bigrams2.add(bigram);
        if (bigrams1.has(bigram)) intersectionCount++;
    }

    return (2 * intersectionCount) / (bigrams1.size + bigrams2.size);
};

/**
 * 字符串相似度计算方法
 */
export const strComputers = {
    levenshteinDistance,
    jaccardSimilarity,
    cosineSimilarity,
    longestCommonSubsequence,
    sorensenDiceCoefficient,
};

/**
 * 通过路径名称实现映射
 * @param targetRoot
 * @param standardRoot
 * @param computer
 */
export const mappingBySkeletonPath = (
    targetRoot: SkeletonNode,
    standardRoot: SkeletonNode,
    computer: (s1: string, s2: string) => number
) => {
    const targetNodes: SkeletonNode[] = [];
    const standardNodes: SkeletonNode[] = [];

    traverseNode(targetRoot, (node) => {
        node.path = node.path
            .split('/')
            .map((name) => uniformName(name))
            .join('/');
        targetNodes.push(node);
    });

    traverseNode(standardRoot, (node) => {
        node.path = node.path
            .split('/')
            .map((name) => uniformName(name))
            .join('/');
        standardNodes.push(node);
    });

    const results: string[][] = [];
    standardNodes.forEach((standardNode) => {
        const similarityValues = targetNodes.map((targetNode) =>
            computer(targetNode.path, standardNode.path)
        );

        // 查找相似度最高的节点作为匹配节点
        let maxIndex = -1;
        let maxSimilarity = -1;
        similarityValues.forEach((similarity, index) => {
            if (similarity > maxSimilarity) {
                maxSimilarity = similarity;
                maxIndex = index;
            }
        });

        // 可以设置一个最小相似性阈值过排除掉不可用的路径匹配，这里不做过滤
        const limitSimilarity = 0;
        if (maxSimilarity > limitSimilarity) {
            results.push([standardNode.path, targetNodes[maxIndex].path]);
            // 已经匹配过的节点不再做匹配
            targetNodes.slice(maxIndex, 1);
        }
    });

    return results;
};
