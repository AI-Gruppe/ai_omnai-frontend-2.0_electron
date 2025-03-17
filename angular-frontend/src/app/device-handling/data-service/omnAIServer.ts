import { HttpClient } from '@angular/common/http';
import { computed, linkedSignal, signal } from '@angular/core';
import { catchError, EMPTY, exhaustMap, Subscription, tap, timer } from 'rxjs';
import { DataFormat, DeviceInformation, DeviceOverview } from './data.models';
import { messageTypeguards } from './message.typeguards';

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
    source: this.#devices,
    computation: (currentDevices, previous) => {
      const previousSelection = previous?.value ?? {};
      const newSelection: Record<string, boolean> = {};

      for (const device of currentDevices) {
        newSelection[device.UUID] = previousSelection[device.UUID] ?? false;
      }

      return newSelection as Record<string, boolean>;
    },
  });

  readonly isDeviceSelected = computed(() => (uuid: string) => {
    const selected = this.selectedDevices()[uuid] ?? false;

    return selected;
  });

  numSelectedDevices = computed(
    () =>
      Object.values(this.selectedDevices()).filter(selected => selected).length
  );

  limitedData = computed(() => {
    const currentData = this.data();
    const downsampledData: Record<string, DataFormat[]> = {};
    const maxDataLenght = 2000; // displaying 2000 datapoints is enough

    for (const [uuid, dataArray] of Object.entries(currentData)) {
      // n sampling rate ratio, which is used to reduce the original data (dataArray) to a limited number of data points (maxDataLength)
      const n = Math.max(1, Math.floor(dataArray.length / maxDataLenght));
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

    // exhaustMap() prevents parallel HTTP requests / race conditions
    this.deviceFetchSubscription = timer(0, this.fetchInterval)
      .pipe(
        exhaustMap(() =>
          this.fetchDevices().pipe(
            catchError(() => {
              this.serverIsReachable.set(false);
              return EMPTY; 
              // Replace Error to ensure that the stream continues, 
              // see https://stackoverflow.com/questions/63545822/how-to-continue-catcherror-in-timer-rxjs
            })
          )
        )
      )
      .subscribe({
        next: () => this.serverIsReachable.set(true),
        error: () => {
          console.error(
            'Unexpected error fetching devices for',
            this.serverURL
          );
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
          } else {
            this.#devices.set([]);
          }
        })
      );
  }

  toggleSelectStateOfDevice(uuid: string) {
    this.selectedDevices.update(value => {
      value[uuid] = !value[uuid];
      return structuredClone(value);
    });
  }

  selectDevice(uuid: string) {
    console.log(uuid, this.selectedDevices()[uuid]);
    this.selectedDevices.update(value => {
      value[uuid] = true;
      return structuredClone(value);
    });
  }

  unselectDevice(uuid: string) {
    console.log(uuid, this.selectedDevices()[uuid]);
    this.selectedDevices.update(value => {
      value[uuid] = false;
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
    // -> We are no longer interested in updating devices when we communicate via websocket.
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
        Object.entries(this.selectedDevices())
          .filter(([_, isSelected]) => isSelected)
          .map(([uuid]) => uuid)
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
