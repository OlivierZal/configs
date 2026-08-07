export interface Capabilities {
  readonly fan_speed: string
  readonly onoff: boolean
}

export const capabilityDefaults: Capabilities = {
  fan_speed: 'auto',
  onoff: false,
}
