import {
    uniformName,
    traverseNode,
    createNodesDict,
    getNodeInfo,
    getPathwayNodes,
    calculateVecDistance,
    createVector,
    calculateNormalVector,
    angleBetweenVectors,
    normalizeArray,
    maybeLeftNode,
    maybeRightNode,
} from './utils';

import type { SkeletonNode } from './types';

interface MaybeHand {
    weight: number;
    root: SkeletonNode;
    fingers: SkeletonNode[];
}

interface HandPart {
    root: SkeletonNode;
    finger: {
        thumb?: SkeletonNode[];
        pinky?: SkeletonNode[];
        ring?: SkeletonNode[];
        index?: SkeletonNode[];
        middle?: SkeletonNode[];
    } | null;
}

interface LegPart {
    start: SkeletonNode;
    end: SkeletonNode;
}
export class SkeletonPart {
    private nodes: SkeletonNode[] = [];

    /**
     * path -> node 字典，方便查找目标节点
     */
    public nodesDict: Record<string, SkeletonNode> = {};

    /**
     * 左右手
     */
    public hand: {
        left: HandPart | null;
        right: HandPart | null;
    } = {
        left: null,
        right: null,
    };

    /**
     * 胸部
     */
    public chestNode: SkeletonNode | null = null;

    /**
     * 左右锁骨
     */
    public clavicular: {
        left: SkeletonNode | null;
        right: SkeletonNode | null;
    } = {
        left: null,
        right: null,
    };

    /**
     * 脖子节点
     */
    public neckNode: SkeletonNode | null = null;

    /**
     * 头部节点
     */
    public headNode: SkeletonNode | null = null;

    /**
     * 髋部节点
     */
    public hipNode: SkeletonNode | null = null;

    /**
     * 左右大腿
     */
    public leg: {
        left: LegPart | null;
        right: LegPart | null;
    } = {
        left: null,
        right: null,
    };

    constructor(rootNode: SkeletonNode) {
        traverseNode(rootNode, (node) => this.nodes.push(node));

        // 统一骨骼节点名称
        this.nodes.forEach((node) => {
            node.path = node.path
                .split('/')
                .map((name) => uniformName(name))
                .join('/');
        });

        // path -> node 字典，方便查找目标节点
        this.nodesDict = createNodesDict(this.nodes);

        this.initHandNodes();
        this.initChestNode();
        this.initClavicularNodes();
        this.initNeckNode();
        this.initHeadNode();
        this.initHipNode();
        this.initLegNodes();
    }

    /**
     * 初始化手掌节点
     * @returns
     */
    private initHandNodes() {
        const maybeHands: Array<MaybeHand> = [];

        // 手指数量
        const fingerCount = 5;
        this.nodes.forEach((maybeHandNode) => {
            // 排除子节点数量小于 5 的节点
            if (maybeHandNode.children.length < 5) return;

            const { leafNodes, maxLeafDepth } = getNodeInfo(maybeHandNode);
            // 按叶子层级分类
            const nodeDepthDict: Record<number, SkeletonNode[]> = {};
            const maybeHandDepth = maybeHandNode.path.split('/').length;
            leafNodes.forEach((leafNode) => {
                const leafNodeDepth = leafNode.path.split('/').length;
                // 计算相对层级
                const differenceDepth = leafNodeDepth - maybeHandDepth;
                if (!nodeDepthDict[differenceDepth]) {
                    nodeDepthDict[differenceDepth] = [leafNode];
                } else {
                    nodeDepthDict[differenceDepth].push(leafNode);
                }
            });

            const leafNodeDepthCate = Object.entries(nodeDepthDict)
                .filter(
                    ([depth, nodes]) =>
                        nodes.length >= fingerCount &&
                        [3, 4].includes(Number(depth))
                )
                .map(([depth, nodes]) => {
                    const depthValue = Number(depth);
                    // 权重计算，以【叶子层级最深】且【同级节点数最接近 5 个】优先
                    const weight =
                        depthValue / maxLeafDepth + fingerCount / nodes.length;
                    return {
                        depth: depthValue,
                        nodes,
                        weight,
                    };
                });

            // 排除无相同叶子层级的节点
            if (!leafNodeDepthCate.length) return;

            // 权重排序
            leafNodeDepthCate.sort((a, b) => b.weight - a.weight);
            maybeHands.push({
                root: maybeHandNode,
                fingers: leafNodeDepthCate[0].nodes,
                weight: leafNodeDepthCate[0].weight,
            });
        });

        maybeHands.sort((a, b) => b.weight - a.weight);
        // 取权重最大的两个节点来推断左右手
        this.inferHands(maybeHands.slice(0, 2));

        if (!this.hand.left || !this.hand.right) {
            this.initHandNodesByName();
        }
    }

    /**
     * 有些 bvh模型文件是不包含手部的，尝试用名称进行查找
     */
    private initHandNodesByName() {
        const handKeywords = ['hand', 'wrist', '手', '腕'];
        const maybeHandNodes = this.nodes.filter((node) => {
            const uniNodeName = uniformName(node.name);
            return handKeywords.some((keyword) =>
                uniNodeName.includes(keyword)
            );
        });

        // 按层级排序去层级较小节点
        maybeHandNodes.sort((a, b) => a.path.length - b.path.length);
        this.inferHandsByName(maybeHandNodes.slice(0, 2));
    }

    /**
     * 通过名字推断左右手方向
     */
    private inferHandsByName(handNodes: SkeletonNode[]) {
        const inferFingerNodes = (handNode: SkeletonNode) => {
            const items = handNode.children.map((fingerNode) => {
                const { leafNodes } = getNodeInfo(fingerNode);
                let maxDistance = 0;
                let fingerLeafNode: SkeletonNode | null = null;

                leafNodes.forEach((leafNode) => {
                    const fingerPathwayNodes = getPathwayNodes(
                        fingerNode,
                        leafNode
                    );
                    let distance = 0;
                    fingerPathwayNodes.reduce((origin, node) => {
                        distance += calculateVecDistance(origin.pos, node.pos);
                        return node;
                    });

                    if (distance > maxDistance) {
                        maxDistance = distance;
                        fingerLeafNode = leafNode;
                    }
                });

                return {
                    start: fingerNode,
                    end: fingerLeafNode!,
                    weight: maxDistance,
                };
            });
            // 权重排序
            items.sort((a, b) => {
                return a.weight - b.weight;
            });
            // 取长度最长的 5 个节点
            const fingerItems = items.slice(-5);
            const fingerKeys = ['thumb', 'pinky', 'ring', 'index', 'middle'];
            const finger: HandPart['finger'] = {};
            while (fingerItems.length && fingerKeys.length) {
                const fingerItem = fingerItems.pop()!;
                const fingerKey = fingerKeys.pop()!;
                Reflect.set(finger, fingerKey, [
                    fingerItem.start,
                    fingerItem.end,
                ]);
            }

            return finger;
        };

        // 通过手指末端节点到手掌的长度来判断不同手指节点
        handNodes.forEach((handNode) => {
            const paths = handNode.path.split('/');
            const matchedLeftPaths = paths.filter((p) => maybeLeftNode(p));
            const matchedRightPaths = paths.filter((p) => maybeRightNode(p));
            const direction =
                matchedRightPaths.length > matchedLeftPaths.length
                    ? 'right'
                    : 'left';
            this.hand[direction] = {
                root: handNode,
                finger: inferFingerNodes(handNode),
            };
        });
    }

    /**
     * 推断左右手
     * @param hands
     */
    private inferHands(hands: MaybeHand[]) {
        hands.forEach((hand) => {
            const fingerDistanceList = hand.fingers.map((finger) => {
                // 手掌到指尖途径的节点（手指关节）
                const fingerPathwayNodes = getPathwayNodes(hand.root, finger);
                // 计算手掌到指尖的距离
                let distance = 0;
                fingerPathwayNodes.reduce((origin, node) => {
                    distance += calculateVecDistance(origin.pos, node.pos);
                    return node;
                });
                return {
                    distance,
                    // 手指根节点
                    start: fingerPathwayNodes[1],
                    // 手指末端节点
                    end: finger,
                };
            });
            // 以手指长度排序
            fingerDistanceList.sort((b, a) => a.distance - b.distance);
            // 取长度最长的 5 个节点
            const fingerItems = fingerDistanceList.slice(-5);
            // 大拇指、小拇指、无名指、食指、中指
            const finger = {
                // 大拇指
                thumb: [fingerItems[0].start, fingerItems[0].end],
                // 小指
                pinky: [fingerItems[1].start, fingerItems[1].end],
                // 无名指
                ring: [fingerItems[2].start, fingerItems[2].end],
                // 食指
                index: [fingerItems[3].start, fingerItems[3].end],
                // 中指
                middle: [fingerItems[4].start, fingerItems[4].end],
            };
            // 通过大拇指与中指计算出手掌所在面的法向量
            const normalVec = calculateNormalVector(
                createVector(hand.root.pos, finger.thumb[0].pos),
                createVector(hand.root.pos, finger.middle[0].pos)
            );

            // 通过 y 轴分量判断左右手
            const direction = normalVec.y > 0 ? 'left' : 'right';
            this.hand[direction] = {
                root: hand.root,
                finger,
            };
        });
    }

    /**
     * 初始化胸部节点，找到双手的交汇节点则为胸部节点
     */
    private initChestNode() {
        if (!this.hand.left || !this.hand.right) {
            this.chestNode = null;
            return;
        }

        const leftHand = this.hand.left.root;
        const rightHand = this.hand.right.root;
        // 统计左右手途径路径计数，计数为 2 且路径最长的交点为胸部
        const pathCounter: Record<string, number> = {};
        const backtrackingPath = (paths: string[]) => {
            while (paths.length) {
                paths.pop();
                const currentKey = paths.join('/');
                pathCounter[currentKey] = (pathCounter[currentKey] || 0) + 1;
            }
        };
        backtrackingPath(leftHand.path.split('/'));
        backtrackingPath(rightHand.path.split('/'));
        // 找到计算为 2 的路径
        const intersectionPaths = Object.entries(pathCounter)
            .filter(([_, count]) => count === 2)
            .map(([p]) => p);
        // 路径长度排序
        intersectionPaths.sort((a, b) => b.length - a.length);
        if (intersectionPaths.length) {
            // 路径最长的交汇点为胸部
            this.chestNode = this.nodesDict[intersectionPaths[0]];
        }
    }

    /**
     * 初始化左右锁骨，胸部往左右手走的第一层节点为锁骨
     */
    private initClavicularNodes() {
        const { chestNode, hand } = this;
        if (!chestNode || !hand.left || !hand.right) return;

        chestNode.children.forEach((node) => {
            if (hand.left!.root.path.includes(node.path)) {
                this.clavicular.left = node;
                return;
            }
            if (hand.right!.root.path.includes(node.path)) {
                this.clavicular.right = node;
            }
        });
    }

    /**
     * 通过胸部节点往上找脖子节点
     * @param handNodes
     * @returns
     */
    private initNeckNode() {
        const { chestNode, clavicular } = this;

        if (!chestNode || !clavicular.left || !clavicular.right) return;

        const { left: leftClavicular, right: rightClavicular } = clavicular;
        // 左锁骨节点想对于胸部向量
        const leftClavicularVec = createVector(
            chestNode.pos,
            leftClavicular.pos
        );
        // 右锁骨节点想对于胸部向量
        const rightClavicularVec = createVector(
            chestNode.pos,
            rightClavicular.pos
        );
        // 左右锁骨平面的法向量
        const shoulderNormalVec = calculateNormalVector(
            leftClavicularVec,
            rightClavicularVec
        );

        let neckNode: SkeletonNode | null = null;
        let maxWeight = 0;

        chestNode.children.forEach((node) => {
            const currentPath = node.path;
            // 排除左右锁骨
            if (
                leftClavicular.path.includes(currentPath) ||
                rightClavicular.path.includes(currentPath)
            ) {
                return;
            }

            // 计算当前节点与左右锁骨的夹角
            const nodeVec = createVector(chestNode.pos, node.pos);
            const leftAngle = angleBetweenVectors(nodeVec, leftClavicularVec);
            const rightAngle = angleBetweenVectors(nodeVec, rightClavicularVec);
            // 计算两个夹角比值，用小角度比大角度，相近比值应该趋于 1
            const weight1 =
                Math.min(leftAngle, rightAngle) /
                Math.max(leftAngle, rightAngle);

            // 节点向量与锁骨平面的法向量夹角
            const nodeToShoulderNormalAngle = angleBetweenVectors(
                nodeVec,
                shoulderNormalVec
            );

            // 计算两个夹角比值，用小角度比大角度，相近比值应该趋于 1
            const weight2 =
                Math.min(90, nodeToShoulderNormalAngle) /
                Math.max(90, nodeToShoulderNormalAngle);

            const weight = weight1 + weight2;
            if (weight > maxWeight) {
                maxWeight = weight;
                neckNode = node;
            }
        });

        this.neckNode = neckNode;
    }

    /**
     * 通过脖子节点网上找头部节点
     * @param handNodes
     * @returns
     */
    private initHeadNode() {
        const { neckNode, chestNode, clavicular } = this;
        if (!neckNode || !chestNode || !clavicular.left || !clavicular.right)
            return;

        // 只有一个子节点，那么子节点就是头部
        if (neckNode.children.length && neckNode.children.length === 1) {
            this.headNode = neckNode.children[0];
            return;
        }

        const { left: leftClavicular, right: rightClavicular } = clavicular;
        // 胸部 -> 左边锁骨向量
        const leftClavicularVec = createVector(
            chestNode.pos,
            leftClavicular.pos
        );
        // 胸部 -> 右边锁骨向量
        const rightClavicularVec = createVector(
            chestNode.pos,
            rightClavicular.pos
        );
        // 胸部 -> 脖子向量
        const chestToNeckVec = createVector(chestNode.pos, neckNode.pos);

        let maxWeight = 0;
        let headNode: SkeletonNode | null = null;

        neckNode.children.forEach((node) => {
            // 计算当前节点与左右锁骨的夹角
            const chestToNodeVec = createVector(chestNode.pos, node.pos);
            const leftAngle = angleBetweenVectors(
                chestToNodeVec,
                leftClavicularVec
            );
            const rightAngle = angleBetweenVectors(
                chestToNodeVec,
                rightClavicularVec
            );
            // 计算两个夹角比值，用小角度比大角度，相近比值应该趋于 1
            const weight1 =
                Math.min(leftAngle, rightAngle) /
                Math.max(leftAngle, rightAngle);

            // （脖子 -> 当前节点）的向量与（胸 -> 脖子）向量的夹角
            const neckToNodeVec = createVector(neckNode.pos, node.pos);
            const angle = angleBetweenVectors(chestToNeckVec, neckToNodeVec);
            const weight2 = 1 - Math.abs(angle) / 180;

            const weight = weight1 + weight2;
            if (weight > maxWeight) {
                maxWeight = weight;
                headNode = node;
            }
        });

        this.headNode = headNode;
    }

    /**
     * 找到胸部节点后，再往父级找到第一个至少具有 3 个分支子节点（左右腿和上半身）的节点即为髋部节点
     */
    private initHipNode() {
        if (!this.chestNode) return;

        const chestPaths = this.chestNode.path.split('/');

        let hipNode: SkeletonNode | null = null;
        while (chestPaths.length && !hipNode) {
            chestPaths.pop();
            const currentNode = this.nodesDict[chestPaths.join('/')];
            if (currentNode && currentNode.children.length >= 3) {
                hipNode = currentNode;
            }
        }

        this.hipNode = hipNode;
    }

    /**
     * 找髋部节点后，进一步推断腿部节点
     */
    private initLegNodes() {
        const { hipNode, chestNode } = this;
        if (!hipNode || !chestNode) return;

        const hipPaths = hipNode.path.split('/');
        hipPaths.pop();
        const rootPath = hipPaths.join('/');
        // 因为不知道大腿根节点在哪个层级，统一从根节点开始早
        const rootNode = this.nodesDict[rootPath] || hipNode;
        // 可能的大腿关节
        const maybeLegNodes: SkeletonNode[] = [];
        traverseNode(rootNode, (node) => {
            // 排除掉根节点、胸部节点及其子节点（上半身节点）
            if (
                node.path.includes(chestNode.path) ||
                node.name === rootNode.name ||
                node.name === hipNode.name
            )
                return;

            const nodePaths = node.path.split('/');
            const currentNodeDepth = nodePaths.length;
            nodePaths.pop();
            const parentNode = this.nodesDict[nodePaths.join('/')];
            // 排除掉不包含兄弟节点的节点
            if (!parentNode || parentNode.children.length < 2) return;

            const { maxLeafDepth } = getNodeInfo(node);
            const depth = maxLeafDepth - currentNodeDepth;
            // 确保节点的层级为 3 或 4
            if (![3, 4].includes(depth)) return;

            maybeLegNodes.push(node);
        });

        // 髋关节到胸部向量
        const hipToChestVec = createVector(hipNode.pos, chestNode.pos);
        // 特征项：夹角、节点长度与深度
        let angleFeatures: number[] = [];
        let distanceFeatures: number[] = [];
        let depthFeatures: number[] = [];
        const legs: Array<LegPart> = [];
        maybeLegNodes.forEach((legNode) => {
            const { leafNodes } = getNodeInfo(legNode);
            let leafAngleFeatures: number[] = [];
            let leafDistanceFeatures: number[] = [];
            let leafDepthFeatures: number[] = [];
            const legNodeDepth = legNode.path.split('/').length;
            // 叶子节点的向量夹角特征与关节长度特征
            const nodeFeatures = leafNodes.map((leafNode) => {
                const legPathwayNodes = getPathwayNodes(legNode, leafNode);
                const legVec = createVector(
                    legPathwayNodes[0].pos,
                    legPathwayNodes[1].pos
                );
                // 计算腿部前两个节点向量与髋到胸部向量的夹角
                const angle = angleBetweenVectors(hipToChestVec, legVec) || 0;
                leafAngleFeatures.push(angle);

                let distance = 0;
                // 腿部节点的总长度
                legPathwayNodes.reduce((origin, node) => {
                    distance += calculateVecDistance(origin.pos, node.pos);
                    return node;
                });
                leafDistanceFeatures.push(distance);

                // 叶子节点的层级
                const depth = leafNode.path.split('/').length - legNodeDepth;
                leafDepthFeatures.push(depth);

                return {
                    angle,
                    distance,
                    depth,
                    start: legNode,
                    end: leafNode,
                };
            });

            // 数值归一化
            leafAngleFeatures = normalizeArray(leafAngleFeatures);
            leafDistanceFeatures = normalizeArray(leafDistanceFeatures);
            leafDepthFeatures = normalizeArray(leafDepthFeatures);
            // 取权重高的特征节点
            let maxWeight = 0;
            let maxNodeFeature = Object.create(null);
            nodeFeatures.forEach((nodeFeature, index) => {
                const weight =
                    leafAngleFeatures[index] +
                    leafDistanceFeatures[index] +
                    leafDepthFeatures[index];
                if (weight > maxWeight) {
                    maxWeight = weight;
                    maxNodeFeature = nodeFeature;
                }
            });
            angleFeatures.push(maxNodeFeature.angle);
            distanceFeatures.push(maxNodeFeature.distance);
            depthFeatures.push(maxNodeFeature.depth);
            legs.push({ start: maxNodeFeature.start, end: maxNodeFeature.end });
        });

        // 数值归一化
        distanceFeatures = normalizeArray(distanceFeatures);
        angleFeatures = normalizeArray(angleFeatures);
        // 计算各个节点权重
        const nodeWeights = legs.map((leg, index) => {
            return {
                leg,
                weight:
                    distanceFeatures[index] +
                    angleFeatures[index] +
                    depthFeatures[index],
            };
        });
        // 权重排序
        nodeWeights.sort((a, b) => b.weight - a.weight);

        if (nodeWeights.length < 2) return;

        // 推断左右腿
        this.inferLegs(nodeWeights.slice(0, 2).map((it) => it.leg));
    }

    /**
     * 推断左右腿，通过腿部根节点到左右锁骨的距离远近判断
     * @param legs
     */
    private inferLegs(legs: LegPart[]) {
        const { clavicular } = this;
        if (!clavicular.left || !clavicular.right) return;

        const features = legs.map((leg) => {
            const leftDistance = calculateVecDistance(
                leg.start.pos,
                clavicular.left!.pos
            );
            const rightDistance = calculateVecDistance(
                leg.start.pos,
                clavicular.right!.pos
            );
            // 计算腿到左右锁骨的距离比值，比值越大则与靠近左边
            const weight = leftDistance / rightDistance;
            return {
                weight,
                leg,
            };
        });

        features.sort((a, b) => b.weight - a.weight);

        const [left, right] = features;
        this.leg.left = left.leg;
        this.leg.right = right.leg;
    }
}

export class SkeletonMapping {
    constructor(
        private standardPart: SkeletonPart,
        private targetPart: SkeletonPart
    ) {}

    /**
     * 骨骼关键节点映射
     * @returns
     */
    private mappingKeyNodes() {
        const { standardPart, targetPart } = this;
        const results: string[][] = [];

        // 髋部
        if (standardPart.hipNode && targetPart.hipNode) {
            results.push([standardPart.hipNode.path, targetPart.hipNode.path]);
        }

        // 胸部
        if (standardPart.chestNode && targetPart.chestNode) {
            results.push([
                standardPart.chestNode.path,
                targetPart.chestNode.path,
            ]);
        }

        // 脖子
        if (standardPart.neckNode && targetPart.neckNode) {
            results.push([
                standardPart.neckNode.path,
                targetPart.neckNode.path,
            ]);
        }

        // 头部
        if (standardPart.headNode && targetPart.headNode) {
            results.push([
                standardPart.headNode.path,
                targetPart.headNode.path,
            ]);
        }

        // 左手
        if (targetPart.hand.left && standardPart.hand.left) {
            results.push([
                standardPart.hand.left.root.path,
                targetPart.hand.left.root.path,
            ]);
        }

        // 右手
        if (targetPart.hand.right && standardPart.hand.right) {
            results.push([
                standardPart.hand.right.root.path,
                targetPart.hand.right.root.path,
            ]);
        }

        return results;
    }

    /**
     * 用于匹配起始子节点到父级节点途径的节点，不包括起始终止节点
     * @param options
     * @returns
     */
    private mappingChildToParentNodes(options: {
        standard: {
            start: SkeletonNode;
            end: SkeletonNode;
        };
        target: {
            start: SkeletonNode;
            end: SkeletonNode;
        };
    }) {
        const { standardPart, targetPart } = this;
        const { standard, target } = options;
        // 结束的节点路径名称
        const standardEndPath = standard.end.path;
        const targetEndPath = target.end.path;
        // 起始路径列表
        const standardStartPaths = standard.start.path.split('/');
        const targetStartPaths = target.start.path.split('/');
        // 当前路径
        let currentStandardPath = standard.start.path;
        let currentTargetPath = target.start.path;

        const results: string[][] = [];

        let next = true;
        // 沿着起始路径往结束位置为止
        while (next) {
            standardStartPaths.pop();
            targetStartPaths.pop();

            currentStandardPath = standardStartPaths.join('/');
            currentTargetPath = targetStartPaths.join('/');

            const standardNode = standardPart.nodesDict[currentStandardPath];
            const targetNode = targetPart.nodesDict[currentTargetPath];

            next =
                currentStandardPath !== standardEndPath &&
                currentTargetPath !== targetEndPath;

            if (next && standardNode && targetNode) {
                results.push([standardNode.path, targetNode.path]);
            }
        }

        return results;
    }

    /**
     * 用于匹配起始父节点点到子节点途径的节点
     * @param options
     * @returns
     */
    private mappingParentToChildNodes(options: {
        standard: {
            start: SkeletonNode;
            end: SkeletonNode;
        };
        target: {
            start: SkeletonNode;
            end: SkeletonNode;
        };
    }) {
        const results: string[][] = [];
        const standardNodes = getPathwayNodes(
            options.standard.start,
            options.standard.end
        );
        const targetNodes = getPathwayNodes(
            options.target.start,
            options.target.end
        );

        // 末端节点单独匹配
        const standardTailNode = standardNodes.pop();
        const targetTailNode = targetNodes.pop();

        while (standardNodes.length && targetNodes.length) {
            const currentStandardNode = standardNodes.shift();
            const currentTargetNode = targetNodes.shift();
            results.push([currentStandardNode!.path, currentTargetNode!.path]);
        }

        results.push([standardTailNode!.path, targetTailNode!.path]);

        return results;
    }

    /**
     * 手臂匹配，锁骨到手掌这一段
     */
    private mappingArmNodes() {
        const { standardPart, targetPart } = this;
        const results: string[][] = [];

        if (
            !standardPart.hand.left ||
            !standardPart.hand.right ||
            !targetPart.hand.left ||
            !targetPart.hand.right ||
            !standardPart.clavicular.left ||
            !standardPart.clavicular.right ||
            !targetPart.clavicular.left ||
            !targetPart.clavicular.right
        ) {
            return results;
        }

        const getUpperNode = (node: SkeletonNode, part: SkeletonPart) => {
            const nodePaths = node.path.split('/');
            nodePaths.pop();
            return part.nodesDict[nodePaths.join('/')];
        };

        results.push(
            // 左手臂
            ...this.mappingParentToChildNodes({
                standard: {
                    start: standardPart.clavicular.left,
                    end: getUpperNode(
                        standardPart.hand!.left!.root,
                        standardPart
                    ),
                },
                target: {
                    start: targetPart.clavicular.left,
                    end: getUpperNode(targetPart.hand!.left.root, targetPart),
                },
            }),
            // 右手臂
            ...this.mappingParentToChildNodes({
                standard: {
                    start: standardPart.clavicular.right,
                    end: getUpperNode(
                        standardPart.hand!.right.root,
                        standardPart
                    ),
                },
                target: {
                    start: targetPart.clavicular.right,
                    end: getUpperNode(targetPart.hand.right.root, targetPart),
                },
            })
        );

        return results;
    }

    /**
     * 匹配胸部到髋部这一段
     */
    private mappingChestToHipNodes() {
        const { standardPart, targetPart } = this;
        const results: string[][] = [];

        if (
            !standardPart.hipNode ||
            !standardPart.chestNode ||
            !targetPart.hipNode ||
            !targetPart.chestNode
        ) {
            return results;
        }

        return this.mappingChildToParentNodes({
            standard: {
                start: standardPart.chestNode,
                end: standardPart.hipNode,
            },
            target: {
                start: targetPart.chestNode,
                end: targetPart.hipNode,
            },
        });
    }

    /**
     * 手指节点映射
     */
    private mappingFingerNodes() {
        const { standardPart, targetPart } = this;
        const results: string[][] = [];

        if (
            !standardPart.hand.left ||
            !standardPart.hand.right ||
            !targetPart.hand.left ||
            !targetPart.hand.right
        ) {
            return results;
        }

        const mappingFingers = (
            standardHand: HandPart,
            targetHand: HandPart
        ) => {
            if (!targetHand.finger || !standardHand.finger) return;

            Object.entries(targetHand.finger).forEach(([key, targetFinger]) => {
                const standardFinger = Reflect.get(
                    standardHand.finger!,
                    key
                ) as SkeletonNode[];

                if (!targetFinger || !standardFinger) return;

                results.push(
                    ...this.mappingParentToChildNodes({
                        standard: {
                            start: standardFinger[0],
                            end: standardFinger[1],
                        },
                        target: {
                            start: targetFinger[0],
                            end: targetFinger[1],
                        },
                    })
                );
            });
        };

        mappingFingers(standardPart.hand.left, targetPart.hand.left);
        mappingFingers(standardPart.hand.right, targetPart.hand.right);

        return results;
    }

    /**
     * 腿部节点映射
     */
    private mappingLegNodes() {
        const { standardPart, targetPart } = this;
        const results: string[][] = [];

        const standardLeftLeg = standardPart.leg.left;
        const standardRightLeg = standardPart.leg.right;
        const targetLeftLeg = targetPart.leg.left;
        const targetRightLeg = targetPart.leg.right;

        if (
            !standardLeftLeg ||
            !standardRightLeg ||
            !targetLeftLeg ||
            !targetRightLeg
        ) {
            return results;
        }

        // 左右腿根节点到末端节点匹配
        return [
            ...this.mappingParentToChildNodes({
                standard: {
                    start: standardLeftLeg.start,
                    end: standardLeftLeg.end,
                },
                target: {
                    start: targetLeftLeg.start,
                    end: targetLeftLeg.end,
                },
            }),
            ...this.mappingParentToChildNodes({
                standard: {
                    start: standardRightLeg.start,
                    end: standardRightLeg.end,
                },
                target: {
                    start: targetRightLeg.start,
                    end: targetRightLeg.end,
                },
            }),
        ];
    }

    public mapping() {
        const results: string[][] = [];
        // 关键点匹配
        results.push(...this.mappingKeyNodes());
        // 手指节点匹配
        results.push(...this.mappingFingerNodes());
        // 匹配左右手臂
        results.push(...this.mappingArmNodes());
        // 胸部到髋部
        results.push(...this.mappingChestToHipNodes());
        // 腿部节点
        results.push(...this.mappingLegNodes());

        return results;
    }
}
