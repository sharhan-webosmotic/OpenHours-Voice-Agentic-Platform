import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from './store';

/**
 * Typed `useDispatch` and `useSelector`, so no component has to annotate them.
 *
 * The untyped hooks return `Dispatch<AnyAction>` and `unknown` state, which means every
 * call site casts. A cast is a place the types stop checking anything, and the point of
 * these two lines is that there are no such places.
 */

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
