import { Component } from '@angular/core';
import { HeroComponent } from "../hero/hero.component";
import { ProgramsComponent } from "../programs/programs.component";
import { WhatWeDoComponent } from "../what-we-do/what-we-do.component";
import { WhyChooseUsComponent } from "../why-choose-us/why-choose-us.component";
import { PricingComponent } from '../pricing/pricing.component';

@Component({
  selector: 'app-home',
  imports: [HeroComponent, ProgramsComponent, WhatWeDoComponent, WhyChooseUsComponent, PricingComponent],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {

}
