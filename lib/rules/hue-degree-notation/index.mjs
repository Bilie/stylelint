import valueParser from 'postcss-value-parser';

import declarationValueIndex from '../../utils/declarationValueIndex.mjs';
import getDeclarationValue from '../../utils/getDeclarationValue.mjs';
import isStandardSyntaxValue from '../../utils/isStandardSyntaxValue.mjs';
import report from '../../utils/report.mjs';
import ruleMessages from '../../utils/ruleMessages.mjs';
import setDeclarationValue from '../../utils/setDeclarationValue.mjs';
import validateOptions from '../../utils/validateOptions.mjs';

const ruleName = 'hue-degree-notation';

const messages = ruleMessages(ruleName, {
	expected: (unfixed, fixed) => `Expected "${unfixed}" to be "${fixed}"`,
});

const meta = {
	url: 'https://stylelint.io/user-guide/rules/hue-degree-notation',
	fixable: true,
};

const HUE_FIRST_ARG_FUNCS = ['hsl', 'hsla', 'hwb'];
const HUE_THIRD_ARG_FUNCS = ['lch', 'oklch'];
const HUE_FUNCS = new Set([...HUE_FIRST_ARG_FUNCS, ...HUE_THIRD_ARG_FUNCS]);
const HAS_HUE_COLOR_FUNC = new RegExp(`\\b(?:${[...HUE_FUNCS].join('|')})\\(`, 'i');

/** @type {import('stylelint').Rule} */
const rule = (primary, _secondaryOptions, context) => {
	return (root, result) => {
		const validOptions = validateOptions(result, ruleName, {
			actual: primary,
			possible: ['angle', 'number'],
		});

		if (!validOptions) return;

		root.walkDecls((decl) => {
			if (!HAS_HUE_COLOR_FUNC.test(decl.value)) return;

			let needsFix = false;
			const parsedValue = valueParser(getDeclarationValue(decl));

			parsedValue.walk((node) => {
				if (node.type !== 'function') return;

				if (!HUE_FUNCS.has(node.value.toLowerCase())) return;

				const hue = findHue(node);

				if (!hue) return;

				const { value } = hue;

				if (!isStandardSyntaxValue(value)) return;

				if (!isDegree(value) && !isNumber(value)) return;

				if (primary === 'angle' && isDegree(value)) return;

				if (primary === 'number' && isNumber(value)) return;

				const fixed = primary === 'angle' ? asDegree(value) : asNumber(value);
				const unfixed = value;

				if (context.fix) {
					hue.value = fixed;
					needsFix = true;

					return;
				}

				const valueIndex = declarationValueIndex(decl);

				report({
					message: messages.expected,
					messageArgs: [unfixed, fixed],
					node: decl,
					index: valueIndex + hue.sourceIndex,
					endIndex: valueIndex + hue.sourceEndIndex,
					result,
					ruleName,
				});
			});

			if (needsFix) {
				setDeclarationValue(decl, parsedValue.toString());
			}
		});
	};
};

/**
 * @param {string} value
 */
function asDegree(value) {
	return `${value}deg`;
}

/**
 * @param {string} value
 */
function asNumber(value) {
	const dimension = valueParser.unit(value);

	if (dimension) return dimension.number;

	throw new TypeError(`The "${value}" value must have a unit`);
}

/**
 * @param {import('postcss-value-parser').FunctionNode} node
 */
function findHue(node) {
	const args = node.nodes.filter(({ type }) => type === 'word' || type === 'function');
	const value = node.value.toLowerCase();

	if (HUE_FIRST_ARG_FUNCS.includes(value)) {
		return args[0];
	}

	if (HUE_THIRD_ARG_FUNCS.includes(value)) {
		return args[2];
	}

	return undefined;
}

/**
 * @param {string} value
 */
function isDegree(value) {
	const dimension = valueParser.unit(value);

	return dimension && dimension.unit.toLowerCase() === 'deg';
}

/**
 * @param {string} value
 */
function isNumber(value) {
	const dimension = valueParser.unit(value);

	return dimension && dimension.unit === '';
}

rule.ruleName = ruleName;
rule.messages = messages;
rule.meta = meta;
export default rule;