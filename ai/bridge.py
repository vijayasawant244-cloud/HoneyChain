import json
from web3 import Web3
from model_service import predict_hive

ARTIFACT = r"C:\Users\VIJAYA SAWANT\OneDrive\Desktop\HoneyChain\blockchain\artifacts\contracts\HoneyBatch.sol\HoneyBatch.json"
CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3"

w3 = Web3(Web3.HTTPProvider("http://127.0.0.1:8545"))
assert w3.is_connected(), "Local node is not running"

with open(ARTIFACT) as f:
    abi = json.load(f)["abi"]

contract = w3.eth.contract(address=Web3.to_checksum_address(CONTRACT_ADDRESS), abi=abi)
account = w3.eth.accounts[0]   # a free test account from the local node


def send(call):
    tx = call.transact({"from": account})
    w3.eth.wait_for_transaction_receipt(tx)


def record_health(batch_id, hive_temp, hive_humidity):
    result = predict_hive(hive_temp, hive_humidity)
    send(contract.functions.setHealth(
        batch_id,
        result["condition"],
        int(round(result["confidence"] * 100)),         # 0.95 -> 95
        int(round(result["est_daily_gain_kg"] * 1000)), # 0.322 kg -> 322 g
    ))
    return result


if __name__ == "__main__":
    batch_id = "HC100"
    if contract.functions.batches(batch_id).call()[0] == "":
        send(contract.functions.createBatch(batch_id, "Vijaya", 1723500000, 40))

    print("AI result:", record_health(batch_id, 22.0, 90.0))
    print("Read back from blockchain:", contract.functions.getHealth(batch_id).call())