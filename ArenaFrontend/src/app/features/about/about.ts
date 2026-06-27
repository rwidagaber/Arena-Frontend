import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-about',
  imports: [RouterLink, RouterLinkActive, TranslateModule],
  templateUrl: './about.html',
  styleUrl: './about.css',
})
export class About {
  activeTab: string = 'mission';
}