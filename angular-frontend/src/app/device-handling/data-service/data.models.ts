type rgb = {
  r: number;
  g: number; 
  b: number;
};

export interface DataFormat {
  timestamp: number;
  value: number;
}

export interface DeviceInformation {
  UUID: string;
  color: rgb;
}

/**
 * Defines the structure of a device overview response.
 *
 * The colors are RGB encoding for each device. The i-th device UUID has an LED
 * whose current color is encoded in the i-th entry of the colors array
 * */
export interface DeviceOverview {
  devices: {
    UUID: string;
  }[];
  colors: {
    color: rgb;
  }[];
}

/**
 * Defines the structure of the data transmitted from one or more OmnAI devices.
 *
 * Each device is identified by a unique UUID. The UUIDs of all connected devices 
 * are sent as an array of strings (`string[]`).
 *
 * Every device collects data points that include a timestamp and a corresponding value. 
 * Since all devices are synchronized, only a **single** timestamp is needed for all devices.
 *
 * The UUIDs in the array are **ordered** in the same sequence as the transmitted values. 
 * This means:
 * - The first UUID corresponds to the first value.
 * - The second UUID corresponds to the second value.
 * - And so on.
 */
export interface omnAIScopeData {
  devices: string[];
  data: {
    timestamp: number;
    value: number[];
  }[];
}
