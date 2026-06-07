import { Component } from '@angular/core';
import { HeaderComponent } from '../../shared/header/header';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-about',
  imports: [HeaderComponent, TranslateModule],
  templateUrl: './about.html',
  styleUrl: './about.css',
})
export class About {

}
