describe('Preview Alignment Guides', () => {
  function selectHiddenOption(selector, value) {
    cy.get(selector).then(($select) => {
      $select.val(value);
      $select[0].dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  function setRangeValue(selector, value) {
    cy.get(selector).then(($range) => {
      $range.val(value);
      $range[0].dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  beforeEach(() => {
    cy.clearLocalStorage();
    cy.visit('/examples/index.html');
    cy.waitForVisualization();
  });

  it('shows a preview-only mounting-area outline for portrait output', () => {
    selectHiddenOption('#aspectRatio', '9:16');

    cy.get('#previewOverlay')
      .should('exist')
      .and('have.css', 'pointer-events', 'none');
    cy.get('#previewOverlay').should('have.css', 'border-top-width', '1px');
    cy.get('#previewOverlay .alignment-grid')
      .should('exist')
      .and('have.css', 'opacity', '0.22');
    cy.get('#visualizer').should('have.prop', 'width', 608);
    cy.get('#visualizer').should('have.prop', 'height', 1080);
  });

  it('reveals smart guides when visualization offsets align to center or grid', () => {
    cy.get('[data-guide="vertical-center"]').should('have.class', 'is-visible');
    cy.get('[data-guide="horizontal-center"]').should('have.class', 'is-visible');

    setRangeValue('#offsetX', 70);
    setRangeValue('#offsetY', 80);
    cy.get('[data-guide="vertical-center"]').should('not.have.class', 'is-visible');
    cy.get('[data-guide="horizontal-center"]').should('not.have.class', 'is-visible');
    cy.get('[data-guide="vertical-grid"]').should('not.have.class', 'is-visible');

    selectHiddenOption('#aspectRatio', '9:16');

    setRangeValue('#offsetX', 152);
    cy.get('[data-guide="vertical-grid"]')
      .should('have.class', 'is-visible')
      .and('have.attr', 'style')
      .and('include', 'left: 75%');

    setRangeValue('#offsetY', -135);
    cy.get('[data-guide="horizontal-grid"]')
      .should('have.class', 'is-visible')
      .and('have.attr', 'style')
      .and('include', 'top: 37.5%');
  });
});
