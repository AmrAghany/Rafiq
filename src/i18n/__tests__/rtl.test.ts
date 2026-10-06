import { I18nManager } from 'react-native';

import { applyLayoutDirection } from '../rtl';

describe('applyLayoutDirection (native)', () => {
  const forceRTL = jest.spyOn(I18nManager, 'forceRTL').mockImplementation(() => {});
  jest.spyOn(I18nManager, 'allowRTL').mockImplementation(() => {});

  function launchedAs(rtl: boolean) {
    Object.defineProperty(I18nManager, 'isRTL', { value: rtl, configurable: true });
  }

  beforeEach(() => forceRTL.mockClear());

  it('needs no restart when the direction already matches', () => {
    launchedAs(false);
    expect(applyLayoutDirection('en')).toBe(false);
    launchedAs(true);
    expect(applyLayoutDirection('ar')).toBe(false);
    expect(forceRTL).not.toHaveBeenCalled();
  });

  it('forces RTL and asks for a restart when switching to Arabic', () => {
    launchedAs(false);
    expect(applyLayoutDirection('ar')).toBe(true);
    expect(forceRTL).toHaveBeenCalledWith(true);
  });

  it('forces LTR and asks for a restart when switching to English', () => {
    launchedAs(true);
    expect(applyLayoutDirection('en')).toBe(true);
    expect(forceRTL).toHaveBeenCalledWith(false);
  });
});
