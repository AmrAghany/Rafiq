import { render, screen } from '@testing-library/react-native';

import { LinkButton, Notice, Text, TextField } from '../ui';

describe('UI accessibility', () => {
  it('scales body text up to 2× and titles up to 1.5×', async () => {
    await render(
      <>
        <Text>Body</Text>
        <Text variant="title">Title</Text>
      </>,
    );
    expect(screen.getByText('Body').props.maxFontSizeMultiplier).toBe(2);
    expect(screen.getByText('Title').props.maxFontSizeMultiplier).toBe(1.5);
  });

  it('announces warnings as alerts but not informational notes', async () => {
    await render(
      <>
        <Notice tone="warn">Something went wrong</Notice>
        <Notice tone="medium">Just so you know</Notice>
      </>,
    );
    const roleOf = (text: string) => screen.getByText(text).parent?.props.accessibilityRole;
    expect(roleOf('Something went wrong')).toBe('alert');
    expect(roleOf('Just so you know')).toBeUndefined();
  });

  it('lets a link carry a fuller label than it shows', async () => {
    await render(<LinkButton label="Remove" accessibilityLabel="Remove: Ful" onPress={() => {}} />);
    expect(screen.getByRole('button', { name: 'Remove: Ful' })).toBeTruthy();
  });

  it("reads a field's error as its hint", async () => {
    await render(<TextField label="Weight" error="Enter your weight" value="" />);
    expect(screen.getByLabelText('Weight').props.accessibilityHint).toBe('Enter your weight');
  });
});
