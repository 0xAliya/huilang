import * as THREE from 'three';

/** 原创角色「提灯人」：斗篷、圆头、围巾，身侧浮着一盏灯。原点在脚底。 */
export class Hero {
  readonly group = new THREE.Group();
  private readonly lantern = new THREE.Group();

  constructor() {
    const cloak = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.2, 0.44, 14),
      new THREE.MeshLambertMaterial({ color: '#35305c' }),
    );
    cloak.position.y = 0.22;

    const scarf = new THREE.Mesh(
      new THREE.TorusGeometry(0.105, 0.04, 8, 18),
      new THREE.MeshLambertMaterial({ color: '#ff7d5c' }),
    );
    scarf.rotation.x = Math.PI / 2;
    scarf.position.y = 0.44;

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 18, 14),
      new THREE.MeshLambertMaterial({ color: '#fff4e3' }),
    );
    head.position.y = 0.6;

    const flame = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 12, 10),
      new THREE.MeshBasicMaterial({ color: '#fff1b8' }),
    );
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 12, 10),
      new THREE.MeshBasicMaterial({ color: '#ffd76a', transparent: true, opacity: 0.3, depthWrite: false }),
    );
    this.lantern.add(halo, flame);
    this.lantern.position.set(0.26, 0.42, 0.06);

    this.group.add(cloak, scarf, head, this.lantern);
  }

  /** 面向行进方向（世界坐标的 xz 位移）。 */
  face(dx: number, dz: number): void {
    if (dx || dz) this.group.rotation.y = Math.atan2(dx, dz);
  }

  update(time: number): void {
    this.lantern.position.y = 0.42 + Math.sin(time * 2.6) * 0.035;
  }

  reset(): void {
    this.group.scale.setScalar(1);
    this.group.rotation.set(0, Math.PI / 4, 0);
  }
}
