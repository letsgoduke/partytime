import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
for(const width of [320,360,390,430,768]){
 test(`invitation fits ${width}px and supports reduced motion`,async({page})=>{
  await page.setViewportSize({width,height:844});await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/');
  await expect(page.getByRole('heading',{name:'Friday at Alex’s',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`test-results/invitation-${width}.png`,fullPage:true});
 });
}
test('guest RSVPs, claims an item, pledges and host confirms',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'I’m coming',exact:true}).first().click();
 await page.getByLabel('Your name').fill('Casey Test');await page.getByRole('button',{name:'Save my RSVP'}).click();
 await expect(page.getByRole('status')).toContainText('You’re on the list');
 await page.getByRole('button',{name:'I’ll bring this'}).first().click();
 await expect(page.getByRole('status')).toContainText('commitment is saved');
 await page.getByRole('button',{name:'Chip in',exact:true}).click();
 await page.getByRole('button',{name:'Pledge $20'}).click();
 await expect(page.getByRole('status')).toContainText('$20 pledged');
 await expect(page.locator('.funding-total')).toContainText('$210');
 await page.goto('/host/demo');await page.getByRole('button',{name:'Contributions',exact:true}).click();
 await page.getByRole('button',{name:'Confirm received'}).last().click();
 await expect(page.getByRole('status')).toContainText('Payment confirmed');
 await page.getByRole('button',{name:'Confirm fulfilled'}).click();
 await expect(page.getByRole('status')).toContainText('Commitment verified');
 await page.getByRole('button',{name:'Wrap up',exact:true}).click();
 await page.getByRole('button',{name:'Review & finalize'}).click();await page.getByRole('button',{name:'Confirm & finalize'}).click();
 await expect(page.getByRole('status')).toContainText('Demo party finalized');
});
test('draft persists on refresh and publishing requires real authentication',async({page})=>{
 await page.goto('/create');await page.getByLabel('Your name as host').fill('Alex');await page.getByLabel('Give it a name').fill('A real good time');await page.getByLabel('Date',{exact:true}).fill('2026-12-18');await page.getByLabel('Private street address').fill('12 Private Lane');await page.getByLabel('Neighborhood').fill('Austin');
 await page.reload();await expect(page.getByLabel('Give it a name')).toHaveValue('A real good time');
 await page.getByRole('button',{name:'What do we need?'}).click();await page.getByLabel('What else would help?').fill('Two bags of ice');await page.getByRole('button',{name:'Add to the list'}).click();
 await expect(page.getByText('1 × Two bags of ice')).toBeVisible();await page.getByRole('button',{name:'Looking good'}).click();await expect(page.getByRole('button',{name:'Publish & invite my people'})).toBeDisabled();
});
test('invitation has no serious accessibility violations',async({page})=>{
 await page.goto('/');const result=await new AxeBuilder({page}).analyze();expect(result.violations.filter(v=>['serious','critical'].includes(v.impact||''))).toEqual([]);
});
