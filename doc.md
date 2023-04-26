## 楔子
![左边导入模型，右边标准骨骼](https://cdn.nlark.com/yuque/0/2023/webp/1039081/1681460879952-40918146-36ad-474d-bf07-0b1078b4c155.webp#clientId=u223c60c6-2775-4&from=paste&height=720&id=ue3132e19&originHeight=720&originWidth=1280&originalType=binary&ratio=1&rotation=0&showTitle=true&size=2838564&status=done&style=none&taskId=u536b5484-f007-4752-b24b-01a4acebc67&title=%E5%B7%A6%E8%BE%B9%E5%AF%BC%E5%85%A5%E6%A8%A1%E5%9E%8B%EF%BC%8C%E5%8F%B3%E8%BE%B9%E6%A0%87%E5%87%86%E9%AA%A8%E9%AA%BC&width=1280 "左边导入模型，右边标准骨骼")
介绍一下需求背景，我们所做的应用是一个基于 [Cocos Creator](https://www.cocos.com/) 引擎用于生产 3D 虚拟角色的[编辑器](https://www.cocos.com/persona)，其有一项很重要的功能是对于角色模型的驱动；用户可以导入自定义的角色模型，经过与**标准人物模型骨架**映射后，即可使用**内置标准动画系统驱动**导入的人物模型，其中很重要的一个环节就是实现**导入模型骨骼**与**标准人物骨骼**的**自动映射**。简单聊聊骨骼映射算法的实现。

附：示例 [GitHub - kinglisky/human-skeleton-mapping: 3D 人物骨骼映射](https://github.com/kinglisky/human-skeleton-mapping)
## 骨骼数据结构
各种 3D [DCC](https://zh.wikipedia.org/wiki/DCC) 工具都支持模型的骨骼绑定，目前我们的标准人物骨骼是基于 [3DS MAX](https://zh.wikipedia.org/wiki/3ds_Max) 规范搭建的，人物骨骼一般是以树状格式存储的。一般以髋部（hip）为人物的起始节点，分为左右大腿与上半身三个子节点，上半身继续往下分化出左右肩膀与头部，以此类推往子级分化。

![髋部节点](https://cdn.nlark.com/yuque/0/2023/png/1039081/1681467549735-095d6f54-ae12-4462-84da-7c3565d35756.png#averageHue=%23283141&clientId=u223c60c6-2775-4&from=paste&height=915&id=u1f962133&originHeight=915&originWidth=1389&originalType=binary&ratio=1&rotation=0&showTitle=true&size=356374&status=done&style=none&taskId=uf4bf50ab-c11c-44e6-932f-82ea51e003d&title=%E9%AB%8B%E9%83%A8%E8%8A%82%E7%82%B9&width=1389 "髋部节点")<br />![右手节点](https://cdn.nlark.com/yuque/0/2023/png/1039081/1681467573570-7b3e01d6-729d-4841-84c9-0a865e886a9b.png#averageHue=%23283141&clientId=u223c60c6-2775-4&from=paste&height=874&id=u69a6b76d&originHeight=874&originWidth=1418&originalType=binary&ratio=1&rotation=0&showTitle=true&size=336043&status=done&style=none&taskId=ub3b80bf4-93d7-4cfb-8fac-8e5a830bedd&title=%E5%8F%B3%E6%89%8B%E8%8A%82%E7%82%B9&width=1418 "右手节点")<br />![骨骼数据结构](https://cdn.nlark.com/yuque/0/2023/png/1039081/1681785674791-e66628cd-c406-43f6-9891-4dbbc660ef38.png#averageHue=%23fbf8f8&clientId=u66c7d33b-6d06-4&from=paste&height=1273&id=u338ca907&originHeight=1273&originWidth=1047&originalType=binary&ratio=1&rotation=0&showTitle=true&size=284235&status=done&style=none&taskId=u3a9bca73-0466-49be-8ad1-743a3b541b9&title=%E9%AA%A8%E9%AA%BC%E6%95%B0%E6%8D%AE%E7%BB%93%E6%9E%84&width=1047 "骨骼数据结构")

```typescript
export interface Vec3 {
    x: number;
    y: number;
    z: number;
}

export interface SkeletonNode {
    name: string;
    path: string;
    pos: Vec3;
    children: SkeletonNode[];
}

const rootNode: SkeletonNode = {
    name: 'hana',
    path: 'scene_root/SceneNode-1/hana',
    pos: { x: 0, y: 0, z: 0 },
    children: [
        {
            name: 'Armature',
            path: 'scene_root/SceneNode-1/hana/Armature',
            pos: { x: 0, y: 0, z: 0 },
            children: [
                {
                    name: 'Hips',
                    path: 'scene_root/SceneNode-1/hana/Armature/Hips',
                    pos: {
                        x: 0,
                        y: 1.0363331089993273,
                        z: 0.000019000133000931006,
                    },
                    children: [
                        /** some children node */
                    ],
                },
            ],
        },
    ],
};
```
骨骼的数据结构如下：

- name 骨骼节点名称
- path 骨骼节点完整路径
- pos 节点的世界坐标
- children 子节点

需要注意，一根骨骼是由一个起点与终点构成路径， pos 表示的骨骼起点的 3D 世界坐标。<br />![image.png](https://cdn.nlark.com/yuque/0/2023/png/1039081/1681785514176-4cf3bff5-6b23-4d32-a98e-021f4c5be106.png#averageHue=%23193e5c&clientId=u66c7d33b-6d06-4&from=paste&height=730&id=u6f6c839f&originHeight=730&originWidth=714&originalType=binary&ratio=1&rotation=0&showTitle=false&size=96022&status=done&style=none&taskId=u7e93f5f3-a7ca-4429-8ab8-c21fcdd4d97&title=&width=714)<br />我们需要实现的就是这样两个人物关键骨骼节点的映射算法，头对头，脚对脚，屁股对屁股。<br />![左目标骨骼，右边标准骨骼](https://cdn.nlark.com/yuque/0/2023/jpeg/1039081/1681786964349-8455d320-9490-46b7-8c2b-7b2cbcdb90e3.jpeg#averageHue=%23262b3e&clientId=u66c7d33b-6d06-4&from=paste&height=768&id=ue75624b1&originHeight=768&originWidth=1366&originalType=binary&ratio=1&rotation=0&showTitle=true&size=164752&status=done&style=none&taskId=ub2231579-89ed-4813-9bf1-c5c9796ae0e&title=%E5%B7%A6%E7%9B%AE%E6%A0%87%E9%AA%A8%E9%AA%BC%EF%BC%8C%E5%8F%B3%E8%BE%B9%E6%A0%87%E5%87%86%E9%AA%A8%E9%AA%BC&width=1366 "左目标骨骼，右边标准骨骼")
## 基于骨骼路径名称实现映射
由于人体骨骼是一个典型的树结构，且每个节点包含了完整路径信息，早期使用的映射算法很简单：**判断两棵骨骼树节点的路径相似度，相似度最高的两个节点即为匹配节点。**<br />那如何判断两个节点的路径相似度？或者换个问法**如何判断两个字符相似度**？找找相应的算法算法即可，比较典型的有：

1. [编辑距离](https://zh.wikipedia.org/zh-hans/%E7%B7%A8%E8%BC%AF%E8%B7%9D%E9%9B%A2)（Edit Distance）：编辑距离是衡量两个字符串之间差异的一种方式，其值为将一个字符串转换成另一个字符串所需的最少单字符编辑操作数。常见的编辑距离算法包括莱文斯坦距离（Levenshtein Distance）和汉明距离（Hamming Distance）等。
2. [Jaccard 相似度](https://baike.baidu.com/item/Jaccard%E7%B3%BB%E6%95%B0/6784913)（Jaccard Similarity）：Jaccard 相似度是衡量两个集合之间相似性的指标，计算方式是两个集合的交集大小除以并集大小。在处理字符串时，可以将字符串视为字符的集合或 n-gram 的集合。
3. [余弦相似度](https://www.zhihu.com/tardis/zm/art/43396514?source_id=1003)（Cosine Similarity）：余弦相似度常用于衡量文本相似性，通过计算两个向量之间的夹角余弦值来度量它们之间的相似度。可以将字符串转换为特征向量（如词袋模型、TF-IDF 或 Word2Vec 表示），然后计算这些向量之间的余弦相似度。
4. [最长公共子序列](https://baike.baidu.com/item/%E6%9C%80%E9%95%BF%E5%85%AC%E5%85%B1%E5%AD%90%E5%BA%8F%E5%88%97/8010952)（**LCS**）是一个在一个序列集合中（通常为两个序列）用来查找所有序列中最长[子序列](https://zh.wikipedia.org/wiki/%E5%AD%90%E5%BA%8F%E5%88%97)的问题。这与查找[最长公共子串](https://zh.wikipedia.org/wiki/%E6%9C%80%E9%95%BF%E5%85%AC%E5%85%B1%E5%AD%90%E4%B8%B2)的问题不同的地方是：子序列不需要在原序列中占用连续的位置 。最长公共子序列问题是一个经典的[计算机科学](https://zh.wikipedia.org/wiki/%E8%AE%A1%E7%AE%97%E6%9C%BA%E7%A7%91%E5%AD%A6)问题，也是[数据比较](https://zh.wikipedia.org/w/index.php?title=%E6%95%B0%E6%8D%AE%E6%AF%94%E8%BE%83&action=edit&redlink=1)程序，比如 Diff 工具，和[生物信息学](https://zh.wikipedia.org/wiki/%E7%94%9F%E7%89%A9%E4%BF%A1%E6%81%AF%E5%AD%A6)应用的基础。它也被广泛地应用在[版本控制](https://zh.wikipedia.org/wiki/%E7%89%88%E6%9C%AC%E6%8E%A7%E5%88%B6)，比如 Git 用来调和文件之间的改变。。
5. [Dice 系数](https://zh.wikipedia.org/wiki/Dice%E7%B3%BB%E6%95%B0)（Sørensen-Dice Coefficient）：Sørensen-Dice 系数是一种基于集合的相似度度量方法，常用于比较字符串。它计算两个集合（可以是字符集合或 n-gram 集合）的交集大小的两倍除以两个集合的大小之和。

实际测试下来，最长公共子序效果稍微好一点，但还无法达到可用的程度，实现如下：
```typescript
import type { SkeletonNode } from './types';

/**
 * 统一驼峰与一些特殊分割符转下划线，转小写
 * @param name
 * @returns
 */
const uniformName = (name: string) => {
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
const traverseNode = (node: SkeletonNode, cb: (item: SkeletonNode) => void) => {
    cb(node);
    (node.children || []).forEach((it) => traverseNode(it, cb));
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
    // 换算成与最长字符的比值
    return maxLength / Math.max(s1.length, s2.length);
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
```
```typescript
const STANDARD_SKELETON_NODE_NAMES = {
  root: '根节点',
  head: '头',
  neck: '脖子',
  upper_chest: '上胸部',
  chest: '胸部',
  spine: '腰部脊柱',
  hips: '盆骨',
  left_shoulder: '左边锁骨',
  left_upper_arm: '左上臂',
  left_lower_arm: '左小臂',
  left_hand: '左手掌',
  right_shoulder: '右边锁骨',
  right_upper_arm: '右上臂',
  right_lower_arm: '右小臂',
  right_hand: '右手掌',
  left_upper_leg: '左边大腿',
  left_lower_leg: '左小腿',
  left_foot: '左脚踝',
  left_toes: '左脚掌',
  left_foot_tip: '左脚尖',
  right_upper_leg: '右边大腿',
  right_lower_leg: '右小腿',
  right_foot: '右脚踝',
  right_toes: '右脚掌',
  right_foot_tip: '右脚尖',
  // ...手指节点
}
```
示例一：较为标准的骨架匹配结果<br />![image.png](https://cdn.nlark.com/yuque/0/2023/png/1039081/1681802611682-bfa16f5f-49dc-46b9-bfe3-099f61a3f629.png#averageHue=%23232837&clientId=u66c7d33b-6d06-4&from=paste&height=615&id=MkDYi&originHeight=615&originWidth=555&originalType=binary&ratio=1&rotation=0&showTitle=false&size=50505&status=done&style=none&taskId=u890f1541-dec5-4ac1-91ed-cc272e0adc0&title=&width=555)<br />![demo.webp](https://cdn.nlark.com/yuque/0/2023/webp/1039081/1682302472764-b81760a9-caee-4557-85bb-3ee627a12fec.webp#clientId=ucddfd112-538e-4&from=paste&height=566&id=u8d086319&originHeight=566&originWidth=1008&originalType=binary&ratio=1&rotation=0&showTitle=false&size=1893672&status=done&style=none&taskId=u53330149-6d7f-4bd6-b487-f77254ed90f&title=&width=1008)<br />示例二：非标准的骨架匹配结果<br />![hana.png](https://cdn.nlark.com/yuque/0/2023/png/1039081/1681802678549-56908ce7-eae7-4893-adc1-364f0693ef70.png#averageHue=%23222735&clientId=u66c7d33b-6d06-4&from=paste&height=749&id=u62ea92b7&originHeight=749&originWidth=512&originalType=binary&ratio=1&rotation=0&showTitle=false&size=43925&status=done&style=none&taskId=uaffffea2-4f38-426f-90ef-fab8cb70ff7&title=&width=512)<br />![demo.webp](https://cdn.nlark.com/yuque/0/2023/webp/1039081/1682303086434-957a1e9c-beae-4f37-a7a8-25beb6c7fa22.webp#clientId=ucddfd112-538e-4&from=paste&height=614&id=ub8db5ebc&originHeight=614&originWidth=1038&originalType=binary&ratio=1&rotation=0&showTitle=false&size=2622666&status=done&style=none&taskId=u711354f8-de57-47d3-90bb-a444f0efe64&title=&width=1038)<br />示例三：日本命名骨架，这种路径匹配就无解了<br />![日本命名骨骼](https://cdn.nlark.com/yuque/0/2023/png/1039081/1681802821380-c151cc26-e905-4f4b-8e84-49feb0ea8ec7.png#averageHue=%23232838&clientId=u66c7d33b-6d06-4&from=paste&height=407&id=aLYEA&originHeight=407&originWidth=450&originalType=binary&ratio=1&rotation=0&showTitle=true&size=23322&status=done&style=none&taskId=u13f909a8-0817-4aec-aa32-8d55d059609&title=%E6%97%A5%E6%9C%AC%E5%91%BD%E5%90%8D%E9%AA%A8%E9%AA%BC&width=450 "日本命名骨骼")<br />基于路径名称实现映射并不是一个可靠的通用方案，在一些比较标准的模型上可以实现较好的效果。但在一些诸如手指，脚尖一类叶子骨骼节点上的映射效果就比较差了，这些节点一些设计师在制作模型时可能只给几个简单的索引命名，还有就是命名差异较大的模型效果就十分鬼畜了。除了匹配精度还有就是多语言的问题，不能保证所有的骨骼命名都使用英文命名。所以需要一个摆脱命名限制**基于骨骼特征实现映射方案**。
## 骨骼关键节点特征检测
先不谈具体实现方式，提个问题，给你两张人物骨骼图片，让你肉眼进行骨骼映射，你是怎么做的？是不是找出图片中两具骨骼对应部位进行匹配，头对头、手对手、脚对脚。如果我们可以检测出两个人物骨骼这些关键特征是不是就可以实现人物骨骼的映射了？
### 如何检测
![image.png](https://cdn.nlark.com/yuque/0/2023/png/1039081/1681873007176-e89dc471-cc55-4e04-9d3a-81ddba577728.png#averageHue=%23232837&clientId=u66c7d33b-6d06-4&from=paste&height=1128&id=uc3e73873&originHeight=1128&originWidth=1029&originalType=binary&ratio=1&rotation=0&showTitle=false&size=226058&status=done&style=none&taskId=u107b4130-f364-4322-a401-bc851ffd3ed&title=&width=1029)人眼很高级，几亿年进化的产物，瞅一眼就知道手脚屁股，快说一句谢谢眼睛。眼睛会抓重点，关键骨骼节点检测我们也需要找到一个**起始节点，**看上面的人物模型，很容易想到从以髋关节为起点：

1. 找到髋关节，髋关节分出 3 个骨骼节点（脊柱，左右腿）
2. 左右脚一路向下到达脚尖
3. 脊柱往上可以找到胸部节点，胸往上分出 3 个骨骼节点（脖子，左右肩膀）
4. 脖子往上是头
5. 左右肩膀往下走是整条手臂可以找手
6. 手会分出 5 个手指，每根手指 3 个关节

大功告成，先来找到髋关节，观察下髋关节的特征：

- 层级较低
- 分出 3 个子节点

![image.png](https://cdn.nlark.com/yuque/0/2023/png/1039081/1681874411951-2c4f917a-1241-42ff-aa81-b89bd69e1bc3.png#averageHue=%23242a3a&clientId=u66c7d33b-6d06-4&from=paste&height=255&id=u476440fe&originHeight=255&originWidth=336&originalType=binary&ratio=1&rotation=0&showTitle=false&size=13403&status=done&style=none&taskId=u7a9e8baa-773d-4e14-8882-234c367b106&title=&width=336)
```typescript
import type { SkeletonNode } from './types';

class SkeletonPart {
    constructor(private nodes: SkeletonNode[]) {}

    findHip() {
        return this.nodes.find((node) => node.children.length === 3);
    }
}
```
那找几个模型验证下？<br />![image.png](https://cdn.nlark.com/yuque/0/2023/png/1039081/1681875068939-62ec998c-5720-41fd-bd32-54006f310c0c.png#averageHue=%23202533&clientId=u66c7d33b-6d06-4&from=paste&height=1272&id=udb3ebfa5&originHeight=1272&originWidth=1561&originalType=binary&ratio=1&rotation=0&showTitle=false&size=457894&status=done&style=none&taskId=u051c24de-8d52-4920-98c4-01851463d48&title=&width=1561)<br />![image.png](https://cdn.nlark.com/yuque/0/2023/png/1039081/1681875171989-96817f24-0e0d-4da2-9f0e-1ac821891224.png#averageHue=%231f2533&clientId=u66c7d33b-6d06-4&from=paste&height=1265&id=u3d4f4ab7&originHeight=1265&originWidth=1557&originalType=binary&ratio=1&rotation=0&showTitle=false&size=536556&status=done&style=none&taskId=u05d89ca7-32fe-42cb-9bab-e852b626662&title=&width=1557)<br />![image.png](https://cdn.nlark.com/yuque/0/2023/png/1039081/1681875276175-67aaed9a-2559-4dc6-a3f8-31146e712f22.png#averageHue=%232d323f&clientId=u66c7d33b-6d06-4&from=paste&height=1264&id=udb504c94&originHeight=1264&originWidth=1562&originalType=binary&ratio=1&rotation=0&showTitle=false&size=397985&status=done&style=none&taskId=uc41f7078-76f5-4606-af73-ea5e3f48d43&title=&width=1562)<br />![image.png](https://cdn.nlark.com/yuque/0/2023/png/1039081/1681875549431-009d628f-b440-440c-a8a6-95c8fa696d17.png#averageHue=%232b303e&clientId=u66c7d33b-6d06-4&from=paste&height=1277&id=ue129bdb9&originHeight=1277&originWidth=1531&originalType=binary&ratio=1&rotation=0&showTitle=false&size=511432&status=done&style=none&taskId=ufce6ac0e-5e49-431e-afff-66441b1423b&title=&width=1531)<br />![image.png](https://cdn.nlark.com/yuque/0/2023/png/1039081/1681875708484-54185b7d-4929-4be2-99eb-8e81d3e1a558.png#averageHue=%2321303d&clientId=u66c7d33b-6d06-4&from=paste&height=1269&id=u7f1dc54d&originHeight=1269&originWidth=1477&originalType=binary&ratio=1&rotation=0&showTitle=false&size=502828&status=done&style=none&taskId=u91ea3c13-5673-4649-adb2-123ac59cfc8&title=&width=1477)<br />为了满足人类奇奇怪怪的 XP，设计师给出的模型可能也是奇奇怪怪的，不是简简单单就能找到髋关节的，主要是髋关节的特征并不明显，不能单通过分化出 3 个节点来作为关键特征。你可能会想到增加特征条件来区分出髋关节，但有个悖论：**想要增加特征判断不可以避免需要使用其子节点信息来断言，而我们需要通过父节点来断言出子节点（脊柱，左右腿）**，这不就死循环了。<br />所以需要换个思路，人类与其他动物最根本的区别是：人类会制造使用工具从事生产劳动，动物则不会，关键就是那双灵巧的**双手**，以手作为起点，人即得以区分。<br />![image.png](https://cdn.nlark.com/yuque/0/2023/png/1039081/1681884613525-24d09c6e-1cb0-43cf-bfde-cdea98fb316a.png#averageHue=%23232836&clientId=u66c7d33b-6d06-4&from=paste&height=1240&id=u32e8d81c&originHeight=1240&originWidth=1612&originalType=binary&ratio=1&rotation=0&showTitle=false&size=334047&status=done&style=none&taskId=u57271427-7ddc-4f64-98c3-154040ce5ae&title=&width=1612)

1. 找出左右手，判断左右手时会依据子节点（手指）的特征来推断
2. 左右手往父级走，两只手臂交汇的地方即为胸部
3. 胸部往双手沿路的第一个节点即为左右锁骨
4. 胸部排除掉左右锁骨且夹在中的就是脖子，脖子往后就是头部
5. 胸部往父级走遇到第一个有多个子节点父节点就是髋关节，髋关节到胸部沿经节点为脊柱（脊柱可能有一到两节）
6. 髋关节排除掉脊柱，剩余骨骼中朝向与脊柱大致相反两根骨骼即为左右大腿
### 检测双手
![image.png](https://cdn.nlark.com/yuque/0/2023/png/1039081/1681900076917-a1ffbb29-edb9-41b7-b9b2-1c576bf93047.png#averageHue=%232e3340&clientId=uaca78c16-54a3-4&from=paste&height=698&id=uf471c734&originHeight=698&originWidth=1090&originalType=binary&ratio=1&rotation=0&showTitle=false&size=190228&status=done&style=none&taskId=u2dee6ca6-86ae-48fc-858f-3e4ef48cec2&title=&width=1090)<br />![image.png](https://cdn.nlark.com/yuque/0/2023/png/1039081/1681900167681-60c7a429-b111-4ed9-ad52-517fd83ec9b0.png#averageHue=%23202533&clientId=uaca78c16-54a3-4&from=paste&height=577&id=ua49b6111&originHeight=577&originWidth=1158&originalType=binary&ratio=1&rotation=0&showTitle=false&size=148732&status=done&style=none&taskId=u8bd18631-9466-4f6c-9018-04228bf2b20&title=&width=1158)<br />先确定手掌节点的关键特征：

- 手部节点至少有 5 个子节点（手指），不排除有些多余节点
- 5 个手指的关节数量是一致的，手指的关节数量为 3 或 4 （注意末端的原点也算作一个节点）
```typescript
import { uniformName, traverseNode, getNodeInfo } from './utils';

import type { SkeletonNode } from './types';

interface MaybeHand {
    weight: number;
    hand: SkeletonNode;
    fingers: SkeletonNode[];
}

export class SkeletonPart {
    private nodes: SkeletonNode[] = [];

    constructor(rootNode: SkeletonNode) {
        traverseNode(rootNode, (node) => this.nodes.push(node));

        // 统一骨骼节点名称
        this.nodes.forEach((node) => {
            node.path = node.path
                .split('/')
                .map((name) => uniformName(name))
                .join('/');
        });

        this.initHandNodes();
    }

    /**
     * 初始化左右手
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
                hand: maybeHandNode,
                fingers: leafNodeDepthCate[0].nodes,
                weight: leafNodeDepthCate[0].weight,
            });
        });

        maybeHands.sort((a, b) => b.weight - a.weight);
        // 取权重最大两个的节点来推断左右手
        this.inferHands(maybeHands.slice(0, 2));
    }

    private inferHands(hands: MaybeHand[]) {
        console.log('inferHands', hands);
    }
}
```
注意这里有个计算节点权重的操作，因为一个可能的手掌节点可能会有多个不同层级候选手指节点，我们需要找到可能性（权重）最大的那个，这里的权重规则比较简单：

- 以叶子层级较深的节点优先
- 以子节点的数量接近 5 优先
### 推断左右手
在不依赖节点名称的前提推断左右手会比较繁琐，需要用到一些空间向量知识。<br />![image.png](https://cdn.nlark.com/yuque/0/2023/png/1039081/1682319975146-153bc2bb-3be9-4d66-8d57-8a0401a6c792.png#averageHue=%23fbfbfb&clientId=ucddfd112-538e-4&from=paste&height=337&id=ue2d1c44d&originHeight=337&originWidth=600&originalType=binary&ratio=1&rotation=0&showTitle=false&size=50273&status=done&style=none&taskId=u45dede8e-b7f8-495c-80f8-284e9a78d57&title=&width=600)
> Cocos Creator 的世界坐标系采用的是笛卡尔右手坐标系，默认 x 向右，y 向上，z 向外，同时使用 -z 轴为正前方朝向。

所以，如果我们可以计算出手掌的 x 向量（大拇指）和 z 向量（中指）就可以通过[叉乘（向量积）](https://baike.baidu.com/item/%E5%90%91%E9%87%8F%E7%A7%AF/4601007)等到法向量 y 通过 y 向量的正负（右手为正，左手为负）就可以推断左右手了。<br />右手法向量：<br />![image.png](https://cdn.nlark.com/yuque/0/2023/png/1039081/1682325428869-9400f542-b737-4e1f-b908-9c1914cac784.png#averageHue=%231f2533&clientId=ucddfd112-538e-4&from=paste&height=506&id=ue80571aa&originHeight=506&originWidth=583&originalType=binary&ratio=1&rotation=0&showTitle=false&size=87274&status=done&style=none&taskId=ud09109c3-6fed-4a47-a628-3afe966db01&title=&width=583)<br />左手法向量：<br />![image.png](https://cdn.nlark.com/yuque/0/2023/png/1039081/1682389073984-31bc4652-872d-438c-b7c1-1c2315d5b4cb.png#averageHue=%231f2533&clientId=ucddfd112-538e-4&from=paste&height=476&id=ua8a2afc0&originHeight=476&originWidth=581&originalType=binary&ratio=1&rotation=0&showTitle=false&size=74754&status=done&style=none&taskId=u1fcf8a6e-3200-48a6-9102-9a858e7cf87&title=&width=581)<br />![image.png](https://cdn.nlark.com/yuque/0/2023/png/1039081/1682389450718-19abe5de-f9b2-4779-80a2-d4e588c6bf79.png#averageHue=%2327b0b2&clientId=ucddfd112-538e-4&from=paste&height=706&id=Rj0tL&originHeight=706&originWidth=1163&originalType=binary&ratio=1&rotation=0&showTitle=false&size=581755&status=done&style=none&taskId=ufebf44f4-75a6-40fe-acaf-0c0cce622c5&title=&width=1163)<br />**需要注意一点，整个手掌与手指不一定都处于一个平面，所以计算时只取第一节手指做向量计算**。向量与叉乘计算很简单：<br />![image.png](https://cdn.nlark.com/yuque/0/2023/png/1039081/1682390336431-c878259c-bef6-477a-a816-6865067a6663.png#averageHue=%23f5f1eb&clientId=ucddfd112-538e-4&from=paste&height=678&id=OTisL&originHeight=678&originWidth=772&originalType=binary&ratio=1&rotation=0&showTitle=false&size=182663&status=done&style=none&taskId=ub0671c3d-4f26-4e43-9228-0e18d08fcef&title=&width=772)<br />叉乘公式如下：<br />$\mathbf{a} \times \mathbf{b} = \begin{bmatrix}
a_{1} \\
a_{2} \\
a_{3}
\end{bmatrix} \times \begin{bmatrix}
b_{1} \\
b_{2} \\
b_{3}
\end{bmatrix} = \begin{bmatrix}
a_{2}b_{3} - a_{3}b_{2} \\
a_{3}b_{1} - a_{1}b_{3} \\
a_{1}b_{2} - a_{2}b_{1}
\end{bmatrix}$
```typescript
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
```
计算手掌的法向量需要用到大拇指与中指，所以接下来先做手指的推断。
### 推断手指
一般人物模型中，手指依据长度从从长到短分为：中指、食指、无名指、小拇指和大拇指，我们只需要计算手指关节的长度就可以知道手指的分类了。可能有些模型会例外，但不影响向量的计算，我们只需要取最长的手指（中指）与最短的手指（大拇指）计算即可。<br />![image.png](https://cdn.nlark.com/yuque/0/2023/png/1039081/1682391967178-af7f79be-8125-4808-8c5d-0a3daa24a359.png#averageHue=%23262728&clientId=ucddfd112-538e-4&from=paste&height=801&id=u7dbd364d&originHeight=801&originWidth=792&originalType=binary&ratio=1&rotation=0&showTitle=false&size=219904&status=done&style=none&taskId=ua406116c-d9c3-4843-80d8-2e4fb46f2d5&title=&width=792)
```typescript
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

/**
 * 计算两点距离
 * @param p1
 * @param p2
 * @returns
 */
const calculateVecDistance = (p1: Vec3, p2: Vec3) => {
    return Math.sqrt(
        (p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2 + (p2.z - p1.z) ** 2
    );
};

export class SkeletonPart {
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
}
```
### 检测胸部
找到左右手后往父级找到第一个**交汇点**就是胸部了。<br />![image.png](https://cdn.nlark.com/yuque/0/2023/png/1039081/1682392897610-55dc5edf-d182-4f31-8683-63e2b82295c7.png#averageHue=%232a303e&clientId=ucddfd112-538e-4&from=paste&height=745&id=u002f7375&originHeight=745&originWidth=1343&originalType=binary&ratio=1&rotation=0&showTitle=false&size=281612&status=done&style=none&taskId=ue5414541-f3ae-41dc-9c1f-e572680998e&title=&width=1343)
```typescript
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
}
```
### 检测左右锁骨
胸部确定后，往左右手走的第一层节点为锁骨。<br />![image.png](https://cdn.nlark.com/yuque/0/2023/png/1039081/1682394853103-d87b7bba-d6c0-4b85-a4d9-54addda89d65.png#averageHue=%232a303d&clientId=ucddfd112-538e-4&from=paste&height=506&id=uca1e0d6e&originHeight=506&originWidth=1078&originalType=binary&ratio=1&rotation=0&showTitle=false&size=165005&status=done&style=none&taskId=uff531260-873b-4164-8a60-4980b2e86e7&title=&width=1078)
```typescript
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
}
```
### 检测脖子
![image.png](https://cdn.nlark.com/yuque/0/2023/png/1039081/1682401439855-92064bad-a359-4259-be93-74ef2afd5001.png#averageHue=%23363b49&clientId=ucddfd112-538e-4&from=paste&height=900&id=LEtfL&originHeight=900&originWidth=1384&originalType=binary&ratio=1&rotation=0&showTitle=false&size=425276&status=done&style=none&taskId=u73aa99d8-e1b5-49b5-a70b-51e5f27ed55&title=&width=1384)<br />胸部除了分化出左右锁骨、脖子以外可能还有其他的节点，例如女性角色用来支撑**欧派**的骨骼节点，该如何区分出脖子与其他节点呢？<br />还是归纳其脖子节点的特征：

- 脖子节点夹在左右锁骨之间且距离两节点距离相近，实现上可以判断节点左右锁骨节点**向量的夹角是否相等**
- 脖子节点几乎是与左右锁骨**共面的**，实现上可以计算脖子节点向量与**左右锁骨所在平面的法向量夹角是否趋于 90 来判断**

![image.png](https://cdn.nlark.com/yuque/0/2023/png/1039081/1682402321761-df334cd0-8949-4f77-9428-7bf4277bbd6b.png#averageHue=%23747b88&clientId=ucddfd112-538e-4&from=paste&height=626&id=u0f6b2d97&originHeight=626&originWidth=918&originalType=binary&ratio=1&rotation=0&showTitle=false&size=372199&status=done&style=none&taskId=ub73ee7cc-be20-4e8d-8dc7-acc08751c5f&title=&width=918)
```typescript
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
}
```
```typescript
export class SkeletonPart {
    /**
     * 脖子节点
     */
    public neckNode: SkeletonNode | null = null;

    /**
     * 通过胸部节点往上找脖子节点
     * @param handNodes
     * @returns
     */
    private initNeckNode() {
        const { chestNode, clavicular } = this;

        if (!chestNode || !clavicular.left || !clavicular.right) return;

        const { left: leftClavicular, right: rightClavicular } = clavicular;
        // 左锁骨节点相对于胸部向量
        const leftClavicularVec = createVector(
            chestNode.pos,
            leftClavicular.pos
        );
        // 右锁骨节点相对于胸部向量
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
            
          	// 使用权重最大的节点
            const weight = weight1 + weight2;
            if (weight > maxWeight) {
                maxWeight = weight;
                neckNode = node;
            }
        });

        this.neckNode = neckNode;
    }
}
```
### 检测头部
脖子往下走如果只有一个节点，那么这个节点就是头部节点了，但不排除有些模型会有些干扰节点存在，如下模型，脖子往下分化出两个节点，一个是头部节点，一个脖子挂载装饰物的节点。还是需要提取头部关键特征：

- 头部节点与脖子一样**与左右锁骨夹角应该是相近的**
- 脖子到头部节点构成向量与胸部到脖子构成的**向量夹角较小**

![image.png](https://cdn.nlark.com/yuque/0/2023/png/1039081/1682404124227-65afaaad-87d9-44c9-85f1-e5da15f58b4b.png#averageHue=%23474b56&clientId=ucddfd112-538e-4&from=paste&height=757&id=u11ad42a0&originHeight=757&originWidth=939&originalType=binary&ratio=1&rotation=0&showTitle=false&size=257027&status=done&style=none&taskId=ue753cedd-95b0-4789-8a11-4ca2108d4d4&title=&width=939)<br />![image.png](https://cdn.nlark.com/yuque/0/2023/png/1039081/1682404333152-7fc6f6cb-9a9a-4a01-8f10-5c14196523ff.png#averageHue=%23474e59&clientId=ucddfd112-538e-4&from=paste&height=820&id=u2a432590&originHeight=820&originWidth=1047&originalType=binary&ratio=1&rotation=0&showTitle=false&size=295430&status=done&style=none&taskId=u19c0ae84-1367-42c1-8a3d-67033f8608f&title=&width=1047)<br />![image.png](https://cdn.nlark.com/yuque/0/2023/png/1039081/1682404386723-cff3873d-2cbf-4f27-9d2d-44acf09611aa.png#averageHue=%23353a46&clientId=ucddfd112-538e-4&from=paste&height=841&id=u16677f78&originHeight=841&originWidth=846&originalType=binary&ratio=1&rotation=0&showTitle=false&size=159057&status=done&style=none&taskId=u76f31ee4-a8ae-4bb8-a21c-198a13dbba0&title=&width=846)
```typescript

export class SkeletonPart {
    /**
     * 头部节点
     */
    public headNode: SkeletonNode | null = null;

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
            // 夹角越小，权重越大
            const weight2 = 1 - Math.abs(angle) / 180;

            const weight = weight1 + weight2;
            if (weight > maxWeight) {
                maxWeight = weight;
                headNode = node;
            }
        });

        this.headNode = headNode;
    }
}
```
### 检测髋关节
髋关节很好找，胸部节点往父级查找，遇到的第一个分化节点且子节点数量大于 3 （左右大腿与脊柱）的节点就是宽关节。<br />![image.png](https://cdn.nlark.com/yuque/0/2023/png/1039081/1682406350568-268039c0-9b29-4930-aaeb-a55282bee726.png#averageHue=%23363d4d&clientId=ucddfd112-538e-4&from=paste&height=738&id=u5a03312c&originHeight=738&originWidth=1022&originalType=binary&ratio=1&rotation=0&showTitle=false&size=218571&status=done&style=none&taskId=u6974df2d-d0c4-43f5-bee1-7bf2053def0&title=&width=1022)
```typescript
export class SkeletonPart {
    /**
     * 髋部节点
     */
    public hipNode: SkeletonNode | null = null;

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
}
```
### 检查大腿
一般情况，大腿都是与**髋关节直接相连在一起的**，排除掉通过胸部的上半身节点后，在剩余的节点中根据骨骼节点的朝向一类的特征就能区分出大腿。<br />![image.png](https://cdn.nlark.com/yuque/0/2023/png/1039081/1682407728387-5c4774e3-65b6-4822-b552-55c93dcf61f2.png#averageHue=%23212634&clientId=ucddfd112-538e-4&from=paste&height=781&id=u787fc62e&originHeight=781&originWidth=605&originalType=binary&ratio=1&rotation=0&showTitle=false&size=50739&status=done&style=none&taskId=u0084e157-6af3-4c5d-a20d-c524a58be42&title=&width=605)<br />![image.png](https://cdn.nlark.com/yuque/0/2023/png/1039081/1682407883290-59b2cdab-8467-4592-be2a-6affeba7f1a9.png#averageHue=%231f2432&clientId=ucddfd112-538e-4&from=paste&height=1008&id=ufd5fbd15&originHeight=1008&originWidth=863&originalType=binary&ratio=1&rotation=0&showTitle=false&size=294857&status=done&style=none&taskId=u9f8b774a-0dee-4622-890b-8b1ffe3ced3&title=&width=863)<br />一般人物模型的大腿朝向几乎是与脊柱相反的，可以根据这个特征来查找大腿节点，但是需要注意，有些特殊的模型大腿不一定是直接挂载在髋关节，如下模型就将其分成了上下身，所以查找大腿节点还不能直接从髋关节开始，需要特殊处理一下。<br />![image.png](https://cdn.nlark.com/yuque/0/2023/png/1039081/1682407641815-b9ff78a4-44b0-4319-b0dd-11e2fa2220dd.png#averageHue=%23232938&clientId=ucddfd112-538e-4&from=paste&height=529&id=u856e2aac&originHeight=529&originWidth=421&originalType=binary&ratio=1&rotation=0&showTitle=false&size=32581&status=done&style=none&taskId=u51c20599-9acb-4c70-9e50-e9bbcc31ccf&title=&width=421)<br />![image.png](https://cdn.nlark.com/yuque/0/2023/png/1039081/1682409661970-9082d364-e079-47d2-b623-21a5c5f2e2d0.png#averageHue=%23242a39&clientId=ucddfd112-538e-4&from=paste&height=733&id=u821f40a9&originHeight=733&originWidth=405&originalType=binary&ratio=1&rotation=0&showTitle=false&size=55100&status=done&style=none&taskId=u22b7ae5f-6277-4f4d-a6e3-341894539c6&title=&width=405)<br />![image.png](https://cdn.nlark.com/yuque/0/2023/png/1039081/1682428284289-577a8319-6781-4f8f-a2b3-b3242deb7e85.png#averageHue=%23252e42&clientId=uc7507dc8-f494-4&from=paste&height=818&id=u8aea8c30&originHeight=1227&originWidth=1822&originalType=binary&ratio=1.5&rotation=0&showTitle=false&size=224844&status=done&style=none&taskId=ud042ef45-37be-4e8d-ba49-43a2c783095&title=&width=1214.6666666666667)<br />归纳下大腿节点几个特征：

- 大腿需要存在兄弟节点（因为有两只腿）
- 整个腿部关节点数量为 4 或 5
- 大腿节点的朝向几乎与上半身相反，实现时可通过大腿**第一节关节**向量与髋关节到胸部向量夹角来判断。
- 优先取叶子节点到髋关节的长度越长的节点作为脚尖
- 优先取叶子节点层级越深的节点作为脚尖
```typescript
interface LegPart {
    start: SkeletonNode;
    end: SkeletonNode;
}
export class SkeletonPart {
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
            // 计算叶子节点的向量夹角特征、关节长度特征、关节深度特征
            const nodeFeatures = leafNodes.map((leafNode) => {
                const legPathwayNodes = getPathwayNodes(legNode, leafNode);
                const legVec = createVector(legPathwayNodes[0].pos, legPathwayNodes[1].pos);
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
                weight: distanceFeatures[index] + angleFeatures[index] + depthFeatures[index],
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
    private inferLegs(legs: LegPart[]) {}
}
```
简单概述下流程：

- 排除掉上半身节点、不包含兄弟节点与到叶子节点层级不符合的节点
- 在所有的候选节点中计算一下特征权重：
   - 计算所有叶子节点的到候选节点的长度
   - 计算所有叶子节点的到候选节点相对层级
   - 计算所有通往叶子节点通路第一级叶子节点的向量与髋关节到胸部向量的夹角
- 取特征权重最高的最高的叶子节点作为候选节点的脚尖节点
- 在所有候选节点中再次计算一次权重，按照权重逆序
- 取权重的最高的两个节点作为双腿腿节点

这里需要注意一点，在计算节点的特征权重时使用[归一化](https://zhuanlan.zhihu.com/p/424518359)处理，将向量夹角、节点长度、节点深度都统一到了 0~1 范围，再计算他们的权重总和。如直接使用夹角、长度、与深度值，它们量纲差别巨大，夹角的对于最终权重影响会是最大的，因为其取值范围最大，所以需要做归一化处理。

> 归一化方法有两种形式，一种是把数变为（0，1）之间的小数，一种是把有[量纲](https://baike.baidu.com/item/%E9%87%8F%E7%BA%B2/100412)[表达式](https://baike.baidu.com/item/%E8%A1%A8%E8%BE%BE%E5%BC%8F/7655228)变为[无量纲](https://baike.baidu.com/item/%E6%97%A0%E9%87%8F%E7%BA%B2/10675963)表达式。主要是为了数据处理方便提出来的，把数据映射到0～1范围之内处理，更加便捷快速，应该归到[数字信号处理](https://baike.baidu.com/item/%E6%95%B0%E5%AD%97%E4%BF%A1%E5%8F%B7%E5%A4%84%E7%90%86/5009)范畴之内。
> 

```typescript
/**
 * 数值归一化
 * @param arr
 * @returns
 */
const normalizeArray = (arr: number[]): number[] => {
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

const res = normalizeArray([0, 20, 50, 70, 100]);
// output [ 0, 0.2, 0.5, 0.7, 1 ]
```
### 推断左右大腿  
大腿节点检查出来就需要推断左右腿了，因为已经知道了左右锁骨，左右的腿的推断也就比较简单了，只需要判断**腿部根节点到左右锁骨的距离**，距离越接近左边的则是左腿，反之亦然。<br />![image.png](https://cdn.nlark.com/yuque/0/2023/png/1039081/1682475061212-f99b9e91-0e0b-489b-aa10-af13005ed502.png#averageHue=%23232836&clientId=ua7dfe1be-4119-4&from=paste&height=1090&id=u7fcfd156&originHeight=1090&originWidth=1050&originalType=binary&ratio=1&rotation=0&showTitle=false&size=216759&status=done&style=none&taskId=ud6e826af-af72-4432-825c-d1ad59a71a2&title=&width=1050)
```typescript
interface LegPart {
    start: SkeletonNode;
    end: SkeletonNode;
}
export class SkeletonPart {
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

    
    /**
     * 推断左右腿，通过腿部根节点到左右锁骨的距离远近判断
     * @param legs
     */
    private inferLegs(legs: LegPart[]) {
        const { clavicular } = this;
        if (!clavicular.left || !clavicular.right) return;

        const features = legs.map((leg) => {
            const leftDistance = calculateVecDistance(leg.start.pos, clavicular.left!.pos);
            const rightDistance = calculateVecDistance(leg.start.pos, clavicular.right!.pos);
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
```
至此我们就已经完成人体主要特征骨骼节点的识别，下面就是映射。
## 基于骨骼关键节点实现映射
### 关键节点匹配
人体骨骼基本特征节点检查完成后，映射就很简单了，只需要头对头，手对手将对应关键节点匹配即可。<br />![image.png](https://cdn.nlark.com/yuque/0/2023/png/1039081/1682476781973-81096019-7b09-43f3-84bb-a5e303097f99.png#averageHue=%23212736&clientId=ua7dfe1be-4119-4&from=paste&height=1028&id=u83ad117f&originHeight=1028&originWidth=1630&originalType=binary&ratio=1&rotation=0&showTitle=false&size=276771&status=done&style=none&taskId=u6f917e7b-94e8-4f52-b4d6-5ebcd5c4965&title=&width=1630)
```typescript
class SkeletonMapping {
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
}
```
### 关键路径匹配
关键节点匹配完成后，剩余就是关键节点之间的路径匹配，因为模型的骨骼标准可能不一致，会有些路径对不上的情况：<br />![mapping.jpg](https://cdn.nlark.com/yuque/0/2023/jpeg/1039081/1682477155451-a40871d2-f926-408c-bc9f-38ee82a2e994.jpeg#averageHue=%23333a4f&clientId=ua7dfe1be-4119-4&from=paste&height=768&id=u3ac0ea0b&originHeight=768&originWidth=1366&originalType=binary&ratio=1&rotation=0&showTitle=false&size=215191&status=done&style=none&taskId=u083e8eb4-0299-4123-acf5-e43bd776b07&title=&width=1366)<br />![mapping.jpg](https://cdn.nlark.com/yuque/0/2023/jpeg/1039081/1682477366047-8d27af0d-1e6f-4ba5-b289-e8f55e5700c2.jpeg#averageHue=%2324293c&clientId=ua7dfe1be-4119-4&from=paste&height=768&id=u7e003ae5&originHeight=768&originWidth=1366&originalType=binary&ratio=1&rotation=0&showTitle=false&size=183911&status=done&style=none&taskId=u17b316c0-9b49-4069-803a-607ae80e0d7&title=&width=1366)<br />![mapping.jpg](https://cdn.nlark.com/yuque/0/2023/jpeg/1039081/1682477564039-fa37c60f-a794-42c5-8b13-6e5a3adc74d1.jpeg#averageHue=%23242b40&clientId=ua7dfe1be-4119-4&from=paste&height=768&id=u6a6e3d94&originHeight=768&originWidth=1366&originalType=binary&ratio=1&rotation=0&showTitle=false&size=378970&status=done&style=none&taskId=u3943f0f8-b45e-4ff1-8dd5-8d739662b82&title=&width=1366)<br />![mapping.jpg](https://cdn.nlark.com/yuque/0/2023/jpeg/1039081/1682477954749-9398f954-08a7-4065-9dde-4b580e33f88f.jpeg#averageHue=%2333475a&clientId=ua7dfe1be-4119-4&from=paste&height=768&id=uef475419&originHeight=768&originWidth=1366&originalType=binary&ratio=1&rotation=0&showTitle=false&size=341300&status=done&style=none&taskId=uf0a5252a-0f46-4341-a313-79b9bd8e137&title=&width=1366)<br />这种情况下确定一种路径分配规则即可，规则可以自行定义，例如：

- 先将路径末端节点匹配
- 剩余的节点从根部开始匹配

![image.png](https://cdn.nlark.com/yuque/0/2023/png/1039081/1682478663879-2beaaa6d-4ff2-43e6-8f28-1e84733d3c6b.png#averageHue=%23202c3e&clientId=ua7dfe1be-4119-4&from=paste&height=1158&id=u1851def4&originHeight=1158&originWidth=1096&originalType=binary&ratio=1&rotation=0&showTitle=false&size=281266&status=done&style=none&taskId=ud5b857f3-86bd-4167-a7b2-3a375ce4100&title=&width=1096)
```typescript
class SkeletonMapping {
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
}
```
自此，映射完成，给大家扭一个。<br />![demo_mini.webp](https://cdn.nlark.com/yuque/0/2023/webp/1039081/1682479579999-9050fb90-621c-4c2f-ae84-312725d6abc4.webp#clientId=ua7dfe1be-4119-4&from=paste&height=360&id=u6433184d&originHeight=360&originWidth=640&originalType=binary&ratio=1&rotation=0&showTitle=false&size=562716&status=done&style=none&taskId=u059c939a-de1b-45e1-b89c-4a2b4c5e3a7&title=&width=640)
## 其他
### 基于骨骼名称实现回退
由于这一套的骨骼映射核心是实现人体特征骨骼检测，而检测的关键又是双手的检测，如果有些模型手部节点缺失或者节点特征不明显时，可以考虑在双手特征检测不到的情况下考虑使用命名检测实现回退：<br />![image.png](https://cdn.nlark.com/yuque/0/2023/png/1039081/1682480117506-2d97e24a-bbaf-4f68-9d4e-1f59f7c18e26.png#averageHue=%231f2432&clientId=ua7dfe1be-4119-4&from=paste&height=1062&id=u89e5beef&originHeight=1062&originWidth=776&originalType=binary&ratio=1&rotation=0&showTitle=false&size=75520&status=done&style=none&taskId=u6c7a3d5b-b7bd-4c29-8003-a633e0b7409&title=&width=776)
```typescript
/**
 * 通过节点名称判断是否为左侧节点
 * @param name
 * @returns
 */
const maybeLeftNode = (name: string) => {
    const reg = /_l|l_|_left|left_/g;
    return reg.test(name);
};

/**
 * 通过节点名称判断是否为右侧节点
 * @param name
 * @returns
 */
const maybeRightNode = (name: string) => {
    const reg = /_r|r_|_right|right_/g;
    return reg.test(name);
};
export class SkeletonPart {
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
}
```
基于名称检测，使用的是匹配关键字，例如匹配手的关键字 `['hand', 'wrist', '手', '腕']`，至于左右手推断可以通过匹配方向关键字 ` /_l|l_|_left|left_/g` or `/_r|r_|_right|right_/g` 出现的频率，频率越到则可能越贴近此方向。

### 一点技巧
在实现人体特征骨骼节点检测时，本质是在一大堆节点找出符合特征的节点，所以得特征的选取就很重要了。将特征转换成权重，**需要衡量特征的量纲**，比如角度的值的量纲范围是 0 ~ 360，而诸如节点的长度（距离）量纲可能只有 0 ~ 3，一般的操作都是做**归一化**，将量纲统一到 0 ~ 1。

### 机器学习
基于特征（规则）实现的映射算法免不了需要经常维护特征规则，还有一种可行思路是使用机器学习通过大量标注骨骼数据训练习得骨骼映射的规则，有机会再研究了。

## 参考资料
- [向量点乘与叉乘的概念及几何意义](https://zhuanlan.zhihu.com/p/359975221)
- [利用机器学习，进行人手的21个3D手关节坐标检测](https://zhuanlan.zhihu.com/p/358811312)
- [基于相似度分析的组件聚类](https://zhuanlan.zhihu.com/p/166364645)
- [如何理解归一化（normalization）?](https://zhuanlan.zhihu.com/p/424518359)

