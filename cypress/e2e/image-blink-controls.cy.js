describe('Image Blink Controls', () => {
  function expectNoOverlap(firstRect, secondRect) {
    const separated = firstRect.right <= secondRect.left ||
      secondRect.right <= firstRect.left ||
      firstRect.bottom <= secondRect.top ||
      secondRect.bottom <= firstRect.top;

    expect(separated).to.equal(true);
  }

  beforeEach(() => {
    cy.clearLocalStorage();
    cy.visit('/examples/index.html');
    cy.waitForVisualization();
  });

  it('keeps frequency range sliders separated and updates their combined value', () => {
    cy.get('#imageBlinkEnabled').then(($checkbox) => {
      $checkbox.prop('checked', true);
      $checkbox[0].dispatchEvent(new Event('change', { bubbles: true }));
    });

    cy.get('#blinkFrequencyMin').then(($input) => {
      $input.val(80);
      $input[0].dispatchEvent(new Event('input', { bubbles: true }));
    });
    cy.get('#blinkFrequencyMax').then(($input) => {
      $input.val(2000);
      $input[0].dispatchEvent(new Event('input', { bubbles: true }));
    });
    cy.get('#blinkFrequencyValue').should('have.text', '80 - 2000');

    cy.get('#blinkFrequencyMin').then(($min) => {
      const minRect = $min[0].getBoundingClientRect();

      cy.get('#blinkFrequencyMax').then(($max) => {
        const maxRect = $max[0].getBoundingClientRect();

        expectNoOverlap(minRect, maxRect);
      });
    });

    cy.get('#blinkIntensity').then(($intensity) => {
      const intensityRect = $intensity[0].getBoundingClientRect();

      cy.get('#blinkFrequencyMax').then(($max) => {
        const maxRect = $max[0].getBoundingClientRect();

        expectNoOverlap(maxRect, intensityRect);
      });
    });
  });
});
