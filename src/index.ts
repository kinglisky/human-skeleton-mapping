import fs from 'fs';
import { SkeletonPart, SkeletonMapping } from './skeleton-mapping';
import targetSkeletonRoot from './skeleton/hana.json';
import standardSkeletonRoot from './skeleton/standard.json';

(async function main() {
    const standardSkeletonPart = new SkeletonPart(standardSkeletonRoot);
    const targetSkeletonPart = new SkeletonPart(targetSkeletonRoot);
    const skeletonMapping = new SkeletonMapping(
        standardSkeletonPart,
        targetSkeletonPart
    );
    const results = skeletonMapping.mapping();
    await fs.promises.writeFile(
        'mapping-results.json',
        JSON.stringify(results)
    );
    console.log('results', results);
})();
