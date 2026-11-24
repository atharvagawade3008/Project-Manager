import * as THREE from 'three';

export interface RoadSegment {
  id: string;
  start: THREE.Vector3;
  end: THREE.Vector3;
  lanes: number;
}

export class RoadNetworkManager {
  private segments: RoadSegment[] = [];

  public addSegment(segment: RoadSegment) {
    this.segments.push(segment);
    // TODO: generate LOD road collision meshes and Seawoods highway junctions
  }

  public getSegments(): RoadSegment[] {
    return this.segments;
  }
}
