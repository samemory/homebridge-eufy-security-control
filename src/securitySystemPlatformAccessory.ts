import { Service, PlatformAccessory, CharacteristicValue, CharacteristicSetCallback, CharacteristicGetCallback } from 'homebridge';

import { EufySecurityPlatform } from './platform';

import { HttpService, LocalLookupService, DeviceClientService, CommandType } from 'eufy-node-client';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class SecuritySystemPlatformAccessory {
  private service: Service;


  constructor(
    private readonly platform: EufySecurityPlatform,
    private readonly accessory: PlatformAccessory,
    private devClientService: DeviceClientService,
    private httpService: HttpService,
  ) {

    this.platform.log.debug('Constructed Switch');
    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Eufy')
      .setCharacteristic(this.platform.Characteristic.Model, 'Security Mode Control')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, accessory.UUID);

    this.service =
      this.accessory.getService(this.platform.Service.SecuritySystem) ||
      this.accessory.addService(this.platform.Service.SecuritySystem);

    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.displayName);

    // create handlers for required characteristics
    this.service.getCharacteristic(this.platform.Characteristic.SecuritySystemCurrentState)
      .on('get', this.handleSecuritySystemCurrentStateGet.bind(this));

    this.service.getCharacteristic(this.platform.Characteristic.SecuritySystemTargetState)
      .on('get', this.handleSecuritySystemTargetStateGet.bind(this))
      .on('set', this.handleSecuritySystemTargetStateSet.bind(this));

  }

  async getCurrentStatus() {
    const hubs = await this.httpService.listHubs();
    const arm_mode_obj = hubs[0].params.filter(param => param.param_type === 1224)

    return this.convertStatusCodeToHomekit(arm_mode_obj[0].param_value);
  }

  convertStatusCodeToHomekit(code: string) {
    switch (code) {
      case "1": //Eufy HOME
        return 0; //homekit home
      case "0": //homekit AWAY
        return 1; //Eufy away
      case "2": //homekit NIGHT
        return 2; //homekit night (for now)
      case "63": //Eufy OFF
        return 3; //homekit disarmed

      default:
        break;
    }
  }

  /**
   * Handle requests to get the current value of the "Security System Current State" characteristic
   */
  async handleSecuritySystemCurrentStateGet(callback) {
    this.platform.log.debug('Triggered GET SecuritySystemCurrentState');

    // set this to a valid value for SecuritySystemCurrentState
    const currentValue = await this.getCurrentStatus();

    callback(null, currentValue);
  }



  /**
   * Handle requests to get the current value of the "Security System Target State" characteristic
   */
  async handleSecuritySystemTargetStateGet(callback) {
    this.platform.log.debug('Triggered GET SecuritySystemTargetState');

    // set this to a valid value for SecuritySystemTargetState
    const currentValue = await this.getCurrentStatus();

    callback(null, currentValue);
  }

  /**
   * Handle requests to set the "Security System Target State" characteristic
   */
  handleSecuritySystemTargetStateSet(value, callback) {
    this.platform.log.debug('Triggered SET SecuritySystemTargetState:', value);

    // CMD_SET_ARMING  # 0 => away 1 => home, 2 => schedule, 63 => disarmed

    let mode = -1;
    switch (value) {
      case 0: //homekit HOME
        mode = 1; //eufy home
        break;
      case 1: //homekit AWAY
        mode = 0; //eufy away
        break;
      case 2: //homekit NIGHT
        mode = 2; //eufy schedule (for now)
        break;
      case 3: //homekit OFF
        mode = 63; //eufy disarmed
        break;
      default:
        break;
    }

    if (mode === -1) {
      this.platform.log.error('Error Setting security mode!')
    }
    else {
      this.devClientService.sendCommandWithInt(CommandType.CMD_SET_ARMING, mode);
      this.service.updateCharacteristic(this.platform.Characteristic.SecuritySystemCurrentState, value)
    }

    callback(null);
  }

}
