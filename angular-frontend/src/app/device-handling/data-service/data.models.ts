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

export interface omnAIScopeData {
  devices: string[];
  data: {
    timestamp: number;
    value: number[];
  }[];
}
