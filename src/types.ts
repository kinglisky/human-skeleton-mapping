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
