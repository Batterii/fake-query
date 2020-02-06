import { noop } from 'lodash';
import sinon from 'sinon';

/**
 * Used internally to track whether the query should resolve or reject.
 */
enum ResultType {
	/**
	 * Indicates that the query should resolve.
	 */
	Success,

	/**
	 * Indicates that the query should reject.
	 */
	Failure,
}

/**
 * A wrapper around a fake Objection.js query builder.
 *
 * @remarks
 * This class exposes a fake QueryBuilder instance on its `builder` property.
 * You can inject the fake into your code under test by stubbing the `#query`
 * method on the desired model.
 *
 * The fake builder automatically creates sinon stubs for any property accessed
 * on the builder, except for the `#then` and `#catch` methods used to execute
 * the query and obtain its result, as normal for Objection and knex query
 * builders. Created stubs always return `this`, as all QueryBuilder methods are
 * chainable.
 *
 * Test code can examine the `stubNames` and `stubs` properties to write
 * assertions about the query. Typically, you will want to do a deep equal
 * assertion on the stub names, followed by sinon assertions on the stubs
 * themselves.
 *
 * By default, the fake builder will neither resolve or reject when executed,
 * as is normal for sinon stubs. If you want it to resolve or reject, simply
 * involve the `#resolves` or `#rejects` methods with the desired result value.
 *
 * Once the fake builder has been executed, it can no longer be changed. If any
 * of its instance methods are invoked, or if you attempt to change its result
 * with `#resolves` or `#rejects`, the invoked method will throw. This ensures
 * that your assertions are always referring to the state of the builder when it
 * was executed, and not after.
 */
export class FakeQuery {
	/**
	 * A map from called method names to the stubs created for those calls.
	 */
	readonly stubs: Record<string, sinon.SinonStub|undefined>;

	/**
	 * The fake builder instance.
	 *
	 * @remarks
	 * This is typed to any to make it easier to inject into your code under
	 * test, without fiddling about with the types in your test code. You should
	 * be able to provide it as the return value of any sinon stub.
	 */
	readonly builder: any;

	/**
	 * The result of the query.
	 */
	private _result?: any;

	/**
	 * Whether the query should resolve or reject.
	 */
	private _resultType?: ResultType;

	/**
	 * The promise for the query result. If present, it means the query has been
	 * executed.
	 */
	private _promise?: Promise<any>;

	/**
	 * Creates a FakeQuery instance.
	 */
	constructor() {
		this.stubs = {};
		this.builder = new Proxy({
			then: (
				onfulfilled?: (value: any) => any,
				onrejected?: (reason: any) => any,
			): Promise<any> => this._execute()
				.then(onfulfilled, onrejected),
			catch: (
				onrejected?: (reason: any) => any,
			): Promise<any> => this._execute().catch(onrejected),
		}, {
			get: (obj: any, prop: string) => {
				if (prop in obj) return obj[prop];
				return this._getStub(prop);
			},
		});
	}

	/**
	 * An array of all keys in the `stubs` property. These will appear in the
	 * order that the stubs were created, thus indicating the order of calls, so
	 * long as no instance method is called more than once.
	 */
	get stubNames(): string[] {
		return Object.keys(this.stubs);
	}

	/**
	 * Configures the query to resolve with the provided value when executed.
	 *
	 * @remarks
	 * This accepts any value, regardless of the state of the builder itself.
	 * Objection query builders can change the type of their result completely
	 * as a result of their method calls, so you should take care to read the
	 * documentation and return a value that makes sense for your test. If your
	 * fake query is a DELETE or UPDATE operation, it should resolve with a
	 * number, for example.
	 *
	 * This method will throw if invoked *after* excution.
	 *
	 * @param value - The resolution value.
	 * @returns The instance, for chaining.
	 */
	resolves(value?: any): this {
		if (this._promise) throw new Error('Fake query already executed');
		this._result = value;
		this._resultType = ResultType.Success;
		return this;
	}

	/**
	 * Configures the query to reject with the provided value when executed.
	 *
	 * @remarks
	 * This method will throw if invoked *after* excution.
	 *
	 * @param reason - The rejection value, usually an Error instance.
	 * @returns The instance, for chaining.
	 */
	rejects(reason: any): this {
		if (this._promise) throw new Error('Fake query already executed');
		this._result = reason;
		this._resultType = ResultType.Failure;
		return this;
	}

	/**
	 * Executes the query and returns its promise. Simply returns the promise,
	 * if it has already been created.
	 * @return The promise for the query's final result.
	 */
	private async _execute(): Promise<any> {
		if (!this._promise) this._promise = this._createPromise();
		return this._promise;
	}

	/**
	 * Creates the promise for the query's final result, based on its state.
	 * @return The created promise.
	 */
	private async _createPromise(): Promise<any> {
		switch (this._resultType) {
			case ResultType.Success:
				return Promise.resolve(this._result);
			case ResultType.Failure:
				return Promise.reject(this._result);
			default:
				return new Promise(noop);
		}
	}

	/**
	 * Returns a stub for the provided property name. If one does not already
	 * exist, it will be created.
	 * @param prop - The property name for the stub.
	 * @returns The stub corresponding to the property name.
	 */
	private _getStub(prop: string): sinon.SinonStub {
		let stub = this.stubs[prop];
		if (!stub) {
			stub = this.stubs[prop] = sinon.stub().named(prop).callsFake(() => {
				if (this._promise) {
					throw new Error('Fake query already executed');
				}
				return this.builder;
			});
		}
		return stub;
	}
}
