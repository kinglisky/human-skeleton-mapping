import type { SkeletonNode, Vec3 } from './types';

/**
 * 统一驼峰与一些特殊分割符转下划线，转小写
 * @param name
 * @returns
 */
export const uniformName = (name: string) => {
    const items = name.split('_');
    return items
        .map((item) => {
            return item
                .replace(/\B([A-Z])|\s|-|~|\/|\\/g, '_$1')
                .toLowerCase()
                .replace(/_+/g, '_');
        })
        .join('_');
};

/**
 * 遍历节点
 * @param node
 * @param cb
 * @returns
 */
export const traverseNode = (
    node: SkeletonNode,
    cb: (item: SkeletonNode) => void
) => {
    cb(node);
    (node.children || []).forEach((it) => traverseNode(it, cb));
};

/**
 * 生成节点 path -> node 的字典
 * @param nodes
 */
export const createNodesDict = (nodes: SkeletonNode[]) => {
    return nodes.reduce((map, node) => {
        map[node.path] = node;
        return map;
    }, {} as Record<string, SkeletonNode>);
};

/**
 * 获取节点信息
 * @param node
 * @returns
 */
export const getNodeInfo = (node: SkeletonNode) => {
    // 最深的叶子层级
    let maxLeafDepth = 0;
    // 叶子节点
    const leafNodes: SkeletonNode[] = [];

    // 所有节点
    const allNodes: SkeletonNode[] = [];
    traverseNode(node, (it) => {
        maxLeafDepth = Math.max(maxLeafDepth, it.path.split('/').length);
        if (!it.children?.length) {
            leafNodes.push(it);
        }
        allNodes.push(it);
    });

    // 最深的叶子节点
    const deepestLeafNodes = leafNodes.filter(
        (it) => it.path.split('/').length === maxLeafDepth
    );

    return {
        maxLeafDepth,
        leafNodes,
        deepestLeafNodes,
        allNodes,
    };
};

/**
 * 获取起始到末端途径的节点
 */
export const getPathwayNodes = (start: SkeletonNode, end: SkeletonNode) => {
    const allNodes: SkeletonNode[] = [];
    traverseNode(start, (node) => {
        allNodes.push(node);
    });
    return allNodes.filter((node) => end.path.includes(node.path));
};

/**
 * 计算两点距离
 * @param p1
 * @param p2
 * @returns
 */
export const calculateVecDistance = (p1: Vec3, p2: Vec3) => {
    return Math.sqrt(
        (p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2 + (p2.z - p1.z) ** 2
    );
};

/**
 * 创建相对目标点的向量
 * @param root
 * @param p
 * @returns
 */
export const createVector = (root: Vec3, p: Vec3) => {
    return {
        x: p.x - root.x,
        y: p.y - root.y,
        z: p.z - root.z,
    } as Vec3;
};

/**
 * 计算两个向量的叉乘（法向量）
 * @param vec1
 * @param vec2
 */
export const calculateNormalVector = (v1: Vec3, v2: Vec3) => {
    return {
        x: v1.y * v2.z - v1.z * v2.y,
        y: v1.z * v2.x - v1.x * v2.z,
        z: v1.x * v2.y - v1.y * v2.x,
    };
};

/**
 * 计算两个向量夹角
 * @param a
 * @param b
 * @returns
 */
export const angleBetweenVectors = (va: Vec3, vb: Vec3): number => {
    const a: number[] = [va.x, va.y, va.z];
    const b: number[] = [vb.x, vb.y, vb.z];

    const dotProduct = (a: number[], b: number[]): number => {
        return a.reduce((acc, cur, i) => acc + cur * b[i], 0);
    };

    const magnitude = (a: number[]): number => {
        return Math.sqrt(a.reduce((acc, cur) => acc + cur ** 2, 0));
    };

    const dot = dotProduct(a, b);
    const magA = magnitude(a);
    const magB = magnitude(b);
    return Math.acos(dot / (magA * magB)) * (180 / Math.PI);
};

/**
 * 数值归一化
 * @param arr
 * @returns
 */
export const normalizeArray = (arr: number[]): number[] => {
    // 计算最大值和最小值
    const maxVal = Math.max(...arr);
    const minVal = Math.min(...arr);

    if (maxVal === minVal) {
        return Array.from({ length: arr.length }).fill(1) as number[];
    }

    // 遍历数组并将每个元素归一化
    const normalizedArr = arr.map((val) => (val - minVal) / (maxVal - minVal));

    return normalizedArr;
};

/**
 * 通过节点名称判断是否为左侧节点
 * @param name
 * @returns
 */
export const maybeLeftNode = (name: string) => {
    const reg = /_l|l_|_left|left_/g;
    return reg.test(name);
};

/**
 * 通过节点名称判断是否为右侧节点
 * @param name
 * @returns
 */
export const maybeRightNode = (name: string) => {
    const reg = /_r|r_|_right|right_/g;
    return reg.test(name);
};
