import {util as chaiUtil, expect} from "chai";
import {FakeQuery} from "../../lib";
import {Model} from "objection";
import sinon from "sinon";

class TestModel extends Model {
	id: number;
}

describe("FakeQuery (Integration)", function() {
	let qry: FakeQuery;

	beforeEach(function() {
		qry = new FakeQuery().resolves();
		sinon.stub(TestModel, "query").returns(qry.builder);
	});

	it("supports resolving with a value", async function() {
		const value = {};
		qry.resolves(value);

		expect(await TestModel.query()).to.equal(value);
	});

	it("supports rejection with a reason", async function() {
		const reason = {};
		qry.rejects(reason);

		return TestModel.query()
			.then(() => {
				throw new Error("Promise should have rejected");
			}, (err) => {
				expect(err).to.equal(reason);
			});
	});

	it("tracks query builder method calls with stubs", async function() {
		await TestModel.query()
			.delete()
			.where("id", ">", 42)
			.returning("*");

		expect(qry.stubNames).to.deep.equal(["delete", "where", "returning"]);
		expect(qry.stubs.delete).to.be.calledOnce;
		expect(qry.stubs.delete).to.be.calledOn(qry.builder);
		expect(qry.stubs.delete).to.be.calledWithExactly();
		expect(qry.stubs.where).to.be.calledOnce;
		expect(qry.stubs.where).to.be.calledOn(qry.builder);
		expect(qry.stubs.where).to.be.calledWithExactly("id", ">", 42);
		expect(qry.stubs.returning).to.be.calledOnce;
		expect(qry.stubs.returning).to.be.calledOn(qry.builder);
		expect(qry.stubs.returning).to.be.calledWithExactly("*");
	});

	it("throws on any builder method calls after execution", async function() {
		const builder = TestModel.query();
		await builder;

		expect(() => {
			builder.findById(42);
		}).to.throw(Error).that.includes({
			message: "Fake query already executed",
		});
	});

	it("throws on resolution value change after execution", async function() {
		const builder = TestModel.query();
		await builder;

		expect(() => {
			qry.resolves({});
		}).to.throw(Error).that.includes({
			message: "Fake query already executed",
		});
	});

	it("throws on rejection value change after execution", async function() {
		const builder = TestModel.query();
		await builder;

		expect(() => {
			qry.rejects({});
		}).to.throw(Error).that.includes({
			message: "Fake query already executed",
		});
	});

	it("reports builder stub names to chai inspect", function() {
		TestModel.query()
			.update()
			.where("id", "<", 42);

		expect(chaiUtil.inspect(qry.builder)).to.equal(
			"{ FakeQuery.builder [ update, where ] }",
		);
	});
});
