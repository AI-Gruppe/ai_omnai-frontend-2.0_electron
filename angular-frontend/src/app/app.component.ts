import { Component, inject } from '@angular/core';
import { DeviceSelectionComponent } from './device-handling/device-selection/device-selection.component';
import { GraphComponent } from './graph/graph/graph.component';
import { KeyValuePipe } from '@angular/common';
import { DataService } from './device-handling/data-service/data.service';

@Component({
  selector: 'app-root',
  imports: [DeviceSelectionComponent, GraphComponent, KeyValuePipe],
  templateUrl: './app.component.html',
})
export class AppComponent {
  title = 'omnAI View';
  dataService = inject(DataService);
}
