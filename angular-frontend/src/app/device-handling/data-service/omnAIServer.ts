import { HttpClient } from '@angular/common/http';
import { signal, computed, linkedSignal } from '@angular/core';
import { Subscription, timer, tap, exhaustMap } from 'rxjs';
import { messageTypeguards } from './message.typeguards';
import { DataFormat, DeviceInformation, DeviceOverview } from './data.models';

function createWSURL(serverURL: string): string {
  return `ws://${serverURL}/ws`;
}

function createDeviceURL(serverURL: string): string {
  return `http://${serverURL}/UUID`;
}

export class ServerDescription {
  readonly #devices = signal<DeviceInformation[]>([]);
  readonly #data = signal<Record<string, DataFormat[]>>({});
  data = this.#data.asReadonly();
  devices = this.#devices.asReadonly();
  #socket: WebSocket | null = null;
  readonly isConnected = signal<boolean>(false);
  readonly wsConnected = signal<boolean>(false);
  readonly serverIsReachable = signal<boolean>(false);
  readonly samplingRate = signal<number>(2000);
  private deviceFetchSubscription: Subscription | null = null;

  /**
   * Signal for managing the selection of devices.
   *
   * **Functionality:**
   * - Stores a mapping of UUIDs to a boolean value (`true` means selected, `false` means not selected).
   * - The selection persists even if the device list (`#devices`) updates.
   * - When new devices are added, they are initialized as not selected (`false`).
   * - If devices are removed, they are also removed from the selection.
   *
   * **Parameters:**
   * - `source`: The current list of devices (`#devices`), which is regularly updated.
   * - `computation`: A function that generates a new selection mapping.
   *   - `currentDevices`: The current list of devices.
   *   - `previous`: The previous selection mapping (containing the last known values).
   *   - **Returns:** A new object with an updated selection, preserving previous values.
   */

  readonly selectedDevices = linkedSignal<
    DeviceInformation[],
    Record<string, boolean>
  >({
    source: () => this.#devices(),
    computation: (currentDevices, previous) => {
      const previousSelection = previous?.value ?? {};
      const newSelection: Record<string, boolean> = {};

      for (const device of currentDevices) {
        newSelection[device.UUID] = previousSelection[device.UUID] ?? false;
      }

      return newSelection as Record<string, boolean>;
    },
  });

  numSelectedDevices = computed(
    () =>
      Object.values(this.selectedDevices()).filter(selected => selected).length
  );

  limitedData = computed(() => {
    const currentData = this.data();
    const downsampledData: Record<string, DataFormat[]> = {};
    const rate = this.samplingRate();

    for (const [uuid, dataArray] of Object.entries(currentData)) {
      const n = Math.max(1, Math.floor(dataArray.length / rate));
      downsampledData[uuid] = dataArray.filter((_, index) => index % n === 0);
    }
    return downsampledData;
  });

  constructor(
    readonly serverURL: string,
    private httpClient: HttpClient,
    private fetchInterval: number = 5000
  ) {
    this.startFetchingDevices();
  }

  /**
   * Starts the periodic retrieval of the device list.
   *
   * This method uses a `timer` to send an HTTP request at regular intervals
   * to fetch the current list of available devices from the server.
   *
   * Workflow:
   * 1. If a subscription (`deviceFetchSubscription`) already exists, it is terminated
   *    to prevent multiple calls or duplicate subscriptions.
   * 2. A new subscription is started:
   *    - `timer(0, this.fetchInterval)`: Creates a timed observable stream
   *      that starts immediately (`0 ms delay`) and then triggers again at `fetchInterval` intervals
   *      (e.g., every 5000 ms = 5 seconds).
   *    - On each execution, `fetchDevices()` is called to fetch the list of devices from the server.
   * 3. The `subscribe` method processes the response:
   *    - If the request is successful (`next` callback), `serverIsReachable` is set to `true`,
   *      indicating that the server is reachable.
   *    - If an error occurs (`error` callback), `serverIsReachable` is set to `false`,
   *      indicating that the server might be unavailable.
   *
   * Important:
   * - This method continues running until `stopFetchingDevices()` is called,
   *   which unsubscribes from the stream and stops the periodic requests.
   */

  private startFetchingDevices(): void {
    if (this.deviceFetchSubscription) {
      this.deviceFetchSubscription.unsubscribe();
    }

    // Starts a new `timer`-based observable stream that begins immediately
    // and then sends requests to the server at fixed "fetchInterval" intervals.
    // exhaustMap() prevents parallel HTTP requests / race conditions, ensuring that
    // if fetching the UUIDs takes longer than the fetchInterval, new requests
    // are paused until the current request is completed.

    this.deviceFetchSubscription = timer(0, this.fetchInterval)
      .pipe(exhaustMap(() => this.fetchDevices()))
      .subscribe({
        next: () => this.serverIsReachable.set(true),
        error: () => {
          console.error('Error fetching devices for', this.serverURL);
          this.serverIsReachable.set(false);
        },
      });
  }

  private fetchDevices() {
    return this.httpClient
      .get<DeviceOverview>(createDeviceURL(this.serverURL))
      .pipe(
        tap(data => {
          if (data.devices && data.colors) {
            const mappedDevices = data.devices.map((device, index) => ({
              UUID: device.UUID,
              color: data.colors[index]?.color ?? { r: 0, g: 0, b: 0 },
            }));
            this.#devices.set(mappedDevices);
          }
        })
      );
  }

  toggleSelectStateOfDevice(uuid: string) {
    console.log(uuid, this.selectedDevices()[uuid]);
    this.selectedDevices.update(value => {
      value[uuid] = !value[uuid];
      console.log(uuid, value[uuid]);
      return structuredClone(value);
    });
  }

  /**
   * Establishes a WebSocket connection to the server.
   *
   * **Workflow:**
   * 1. Stops the periodic retrieval of the device list since we now have a real-time connection.
   * 2. Checks if an active WebSocket connection already exists. If so, nothing happens.
   * 3. Creates a new WebSocket connection to the server.
   * 4. Handles various WebSocket events (`open`, `message`, `close`).
   *
   * **Why?**
   * - WebSockets enable real-time communication, eliminating the need for constant data polling.
   * - If a connection is already open, no new one is created (`if (this.#socket && this.#socket.readyState === WebSocket.OPEN)`).
   * - After opening (`open` event), a message is sent to the server to request device data.
   * - Incoming messages (`message` event) are processed and stored.
   * - If the connection is closed (`close` event), the status is reset.
   */
  connect(): void {
    // Why the fetching stops when websocket is connected ?
    this.stopFetchingDevices();

    if (this.#socket && this.#socket.readyState === WebSocket.OPEN) {
      console.log('WebSocket is already connected.');
      return;
    }

    this.#socket = new WebSocket(createWSURL(this.serverURL));

    this.#socket.addEventListener('open', () => {
      if (!this.#socket) return;

      this.#data.set({});
      this.isConnected.set(true);

      this.#socket.send(
        this.devices()
          .map(d => d.UUID)
          .join(' ')
      );
    });

    /**
     * Event: `message` - Triggered when a message is received from the server.
     * - The first two messages are ignored (`ignoreCounter`), as they may contain connection initialization data.
     * - The received data is parsed as JSON.
     * - If the data follows a valid OmnAI structure, the sensor data is stored.
     */

    const countOfFirstIgnoredMessages = 2;
    let ignoreCounter = 0;

    this.#socket.addEventListener('message', event => {
      if (!this.#socket) return;
      if (ignoreCounter < countOfFirstIgnoredMessages) {
        // the first messages contain garabge smtimes
        ignoreCounter++;
        return;
      }

      let parsedMessage: unknown;
      try {
        parsedMessage = JSON.parse(event.data);
      } catch {
        parsedMessage = event.data;
      }

      if (messageTypeguards.isOmnAIDataMessage(parsedMessage)) {
        this.#data.update(records => {
          parsedMessage.devices.forEach((uuid, index) => {
            const existingData = records[uuid] ?? [];
            const newDataPoints = parsedMessage.data.flatMap(point => ({
              timestamp: point.timestamp,
              value: point.value[index],
            }));
            records[uuid] = existingData.concat(newDataPoints);
          });

          return structuredClone(records);
        });
      } else {
        console.warn('Unbekanntes Nachrichtenformat:', parsedMessage);
      }
    });

    this.#socket.addEventListener('close', () => {
      if (!this.#socket) return;
      this.isConnected.set(false);
      this.#socket = null;
    });

    this.#socket.addEventListener('error', error => {
      console.error('WebSocket Fehler:', error);
      this.isConnected.set(false);
    });
  }

  disconnect(): void {
    if (this.#socket) {
      this.#socket.close();
    } else {
    }
    this.startFetchingDevices();
  }

  stopFetchingDevices() {
    if (this.deviceFetchSubscription) {
      this.deviceFetchSubscription.unsubscribe();
      this.deviceFetchSubscription = null;
    }
  }
  setSamplingRate(newRate: number): void {
    this.samplingRate.set(newRate);
  }
}
