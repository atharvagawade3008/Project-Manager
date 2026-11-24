export interface HudState {
  speedKmh: number;
  gear: number;
  activeObjective: string;
  radarBlipsCount: number;
}

export class HudOverlay {
  private state: HudState = {
    speedKmh: 0,
    gear: 1,
    activeObjective: 'Drive to Nerul Station',
    radarBlipsCount: 4,
  };

  public updateSpeed(speed: number) {
    this.state.speedKmh = Math.round(speed * 3.6);
  }

  public render(container: HTMLElement) {
    container.innerHTML = `
      <div class="hud-speedometer">${this.state.speedKmh} KM/H</div>
      <div class="hud-objective">${this.state.activeObjective}</div>
    `;
  }
}
